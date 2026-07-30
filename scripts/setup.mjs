#!/usr/bin/env node
// One-shot setup for a self-hosted deploy: create the D1 database, write its id into wrangler.jsonc,
// and apply the migrations remotely. Everything here is idempotent — re-running it on a configured
// repo reuses the existing database and re-applies nothing.
//
// It deliberately stops short of deploying: `wrangler deploy` publishes whatever files exist on disk
// at that moment, so it stays a deliberate act. See docs/self-hosting.md.
//
// The pure helpers are exported and covered by tests/scripts/setup.test.mjs — a typo in the config
// patching would break the first command a self-hoster ever runs.

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export const CONFIG_PATH = join(dirname(dirname(fileURLToPath(import.meta.url))), 'wrangler.jsonc');

export function parseArgs(argv) {
  return Object.fromEntries(argv.map((arg) => {
    const [key, ...rest] = arg.replace(/^--/, '').split('=');
    return [key, rest.join('=') || true];
  }));
}

/** Wrangler may print a banner before the JSON payload, so parse from the first bracket onwards. */
export function parseJsonOutput(stdout) {
  const start = stdout.search(/[[{]/);
  if (start < 0) return null;
  try { return JSON.parse(stdout.slice(start)); } catch { return null; }
}

/** D1's API calls the id `uuid`; the alternatives cover wrangler renaming the field under us. */
export function databaseIdFrom(listOutput, name) {
  const databases = parseJsonOutput(listOutput);
  if (!Array.isArray(databases)) return null;
  const match = databases.find((database) => database?.name === name);
  return match ? (match.uuid ?? match.id ?? match.database_id ?? null) : null;
}

/**
 * Surgical string edits: JSON.parse would round-trip away every comment in wrangler.jsonc. The worker
 * name pattern is anchored to the start of a line so it cannot hit the `"name"` of a rate limiter.
 */
export function configPatches({ databaseId, dbName, contact, workerName }) {
  const patches = [
    [/("database_id"\s*:\s*")[^"]*(")/, `$1${databaseId}$2`],
    [/("database_name"\s*:\s*")[^"]*(")/, `$1${dbName}$2`],
  ];
  // The user agent is what MyAnimeList sees. Left unchanged, a fork's traffic is attributed to the
  // upstream author's domain.
  if (contact) patches.push([/("MAL_USER_AGENT"\s*:\s*")[^"]*(")/, `$1jikan-edge/0.1 (+${contact})$2`]);
  if (workerName) patches.push([/^(\s*"name"\s*:\s*")[^"]*(")/m, `$1${workerName}$2`]);
  return patches;
}

export function applyPatches(source, patches) {
  let updated = source;
  for (const [pattern, replacement] of patches) {
    if (!pattern.test(updated)) throw new Error(`Could not find ${pattern} in wrangler.jsonc — edit it by hand (see docs/self-hosting.md).`);
    updated = updated.replace(pattern, replacement);
  }
  return updated;
}

async function main(argv) {
  const options = parseArgs(argv);
  const dbName = typeof options['db-name'] === 'string' ? options['db-name'] : 'jikan-edge';
  const workerName = typeof options['worker-name'] === 'string' ? options['worker-name'] : null;
  const contact = typeof options.contact === 'string' ? options.contact : null;

  const say = (message) => process.stdout.write(`${message}\n`);
  const fail = (message) => { process.stderr.write(`\n✖ ${message}\n`); process.exit(1); };

  // Wrangler runs through npx so the repo's pinned version is used rather than a global install.
  const wrangler = (args, { capture = true } = {}) => {
    const result = spawnSync('npx', ['--no-install', 'wrangler', ...args], {
      encoding: 'utf8',
      shell: process.platform === 'win32',
      stdio: capture ? 'pipe' : 'inherit',
    });
    if (result.error) fail(`Could not run wrangler: ${result.error.message}`);
    return { ok: result.status === 0, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
  };

  say('\njikan-edge setup\n');

  if (!wrangler(['--version']).ok) fail('Wrangler is not available. Run "npm install" in this repo first.');
  const whoami = wrangler(['whoami']);
  if (!whoami.ok || /not authenticated|not logged in/i.test(whoami.stdout)) fail('Not logged in to Cloudflare. Run "npx wrangler login" first.');
  const account = whoami.stdout.match(/([\w.+-]+@[\w-]+\.[\w.]+\w)/);
  say(`✔ Cloudflare account${account ? ` (${account[1]})` : ''}`);

  const listed = () => { const result = wrangler(['d1', 'list', '--json']); return result.ok ? databaseIdFrom(result.stdout, dbName) : null; };
  let databaseId = listed();
  if (databaseId) {
    say(`✔ D1 "${dbName}" already exists — reusing it`);
  } else {
    say(`… creating D1 database "${dbName}"`);
    const created = wrangler(['d1', 'create', dbName]);
    if (!created.ok) fail(`Could not create the D1 database:\n${created.stderr || created.stdout}`);
    databaseId = listed() ?? (created.stdout.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i) ?? [])[0];
    if (!databaseId) fail(`Database created, but its id could not be read from wrangler's output. Copy it from the Cloudflare dashboard into wrangler.jsonc.\n${created.stdout}`);
    say(`✔ D1 "${dbName}" created`);
  }

  const original = readFileSync(CONFIG_PATH, 'utf8');
  let updated;
  try { updated = applyPatches(original, configPatches({ databaseId, dbName, contact, workerName })); }
  catch (error) { fail(error.message); }
  if (updated !== original) { writeFileSync(CONFIG_PATH, updated); say('✔ wrangler.jsonc updated'); }
  else say('✔ wrangler.jsonc already up to date');

  say('\n… applying migrations to the remote database\n');
  if (!wrangler(['d1', 'migrations', 'apply', dbName, '--remote'], { capture: false }).ok) {
    fail('Migrations failed. Fix the error above, then re-run "npm run db:migrate:remote".');
  }

  say('\n✔ Setup complete.\n');
  say('Next:');
  say('  npx wrangler deploy');
  say(`  curl https://${workerName ?? 'YOUR-WORKER'}.<your-subdomain>.workers.dev/health   # checks.database must read "ok"`);
  if (!contact) say('\nBefore sending real traffic, point MAL_USER_AGENT in wrangler.jsonc at your own URL\n(or re-run with --contact=https://your-worker.workers.dev to set it automatically).');
}

// Guarded so the helpers above can be imported by tests without running the whole setup.
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await main(process.argv.slice(2));
