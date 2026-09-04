import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// `AGENTS.md` and `.claude/CLAUDE.md` are the same document under two names, because the tools that
// read them look for different filenames. Nothing in the repository keeps a duplicated 47 KB file in
// step, and it has already drifted once unnoticed: the copy had come to name `.Codex/launch.json`,
// a path that does not exist, where the original names `.claude/launch.json`. That divergence lived
// outside version control, so it left no trace — the same edit today would land in a commit and be
// just as invisible in a 47 KB diff.
//
// Same reasoning as reading the real `wrangler.jsonc` in `env.test.ts`: two places that must agree,
// with a silent failure mode when they stop agreeing.
const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8');

describe('the agent guide under both of its names', () => {
  const canonical = read('.claude/CLAUDE.md');
  const copy = read('AGENTS.md');

  it('is byte-identical, so neither reader gets a different set of rules', () => {
    if (copy === canonical) return;
    // A bare toEqual on 47 KB prints a diff nobody can read. Point at the first divergence instead.
    const canonicalLines = canonical.split(/\r?\n/);
    const copyLines = copy.split(/\r?\n/);
    const at = canonicalLines.findIndex((line, index) => line !== copyLines[index]);
    throw new Error(
      at === -1
        ? `AGENTS.md and .claude/CLAUDE.md differ in length: ${copyLines.length} lines against ${canonicalLines.length}. Copy .claude/CLAUDE.md over AGENTS.md.`
        : [
            `AGENTS.md has drifted from .claude/CLAUDE.md at line ${at + 1}. Copy .claude/CLAUDE.md over AGENTS.md.`,
            `  .claude/CLAUDE.md: ${canonicalLines[at] ?? '(missing)'}`,
            `  AGENTS.md:         ${copyLines[at] ?? '(missing)'}`,
          ].join('\n'),
    );
  });

  // The byte comparison above already covers this, but it fails as "line 40 differs", which does not
  // say why it matters. This one names the mistake that actually happened.
  it('points at the launch config that exists', () => {
    for (const [name, text] of [
      ['.claude/CLAUDE.md', canonical],
      ['AGENTS.md', copy],
    ] as const) {
      expect(text, name).toContain('.claude/launch.json');
      expect(text, name).not.toContain('.Codex/launch.json');
    }
  });
});
