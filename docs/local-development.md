# Local development

1. Install dependencies with `pnpm install`. **Not `npm install`** — `package.json` pins
   `packageManager: pnpm@11`, the only lockfile here is `pnpm-lock.yaml`, and CI runs
   `pnpm install --frozen-lockfile`. Installing with npm resolves a different tree and ignores
   `pnpm-workspace.yaml`, whose `allowBuilds` is what lets esbuild and workerd run their postinstall.
2. To run on **another** Cloudflare account, follow [`self-hosting.md`](self-hosting.md) — `npm run setup` creates the D1 database and writes its id into `wrangler.jsonc`. The committed configuration points at this milestone's resources; there is no longer an R2 bucket to create.
3. Run `npm run db:migrate:local`. `npm run dev` starts a local preview with remote bindings, which is the recommended way to validate the MAL fetch; `npm run dev:local` uses the simulator for health and local D1 only.
4. The commit hook needs no step: `pnpm install` runs the root `prepare` script, which sets
   `core.hooksPath` to `.githooks` **only if nothing else claims it**. Git versions the hook but not
   the setting that points at it, so without that a fresh clone would have `.githooks/commit-msg` on
   disk and inactive. It strips AI attribution trailers from commit messages, leaving a human
   `Co-authored-by` alone. If you already point `core.hooksPath` somewhere of your own, the script
   leaves your value alone and this repo's hook stays inert — wire it by hand, or move the file into
   the directory you do use. Worth knowing either way: `core.hooksPath` **replaces** `.git/hooks`
   rather than adding to it.
5. Before pushing, run the three checks CI runs, in this order:

   ```bash
   pnpm run lint         # Biome: format and lint in one pass, with --error-on-warnings
   pnpm run typecheck
   pnpm test
   ```

   `pnpm test` is the unit suite only — vitest's default config excludes `tests/integration/**`,
   which needs a real workerd and runs under `pnpm run test:integration`. Note that neither vitest
   config enables `test.typecheck`, so a type-only mistake is invisible to the suite and `typecheck`
   is the gate that catches it.

Local development creates D1 state in the `.wrangler` directory. Do not use `load.json`: this milestone uses public HTML pages only. For a manual check, use `/v1/users/AMayacrab` without turning that name into configuration or hard-coded data.
