import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { renderChangelogPage, renderInline, renderMarkdown } from './render';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const changelog = read('../../CHANGELOG.md');
const page = () => renderChangelogPage(changelog, read('./template.html'));
const sectionsOf = (html: string) => html.slice(html.indexOf('<section class="entry">'));

describe('the changelog page', () => {
  // `site/changelog.html` is generated, never edited: it was a hand-kept mirror that stopped on
  // 2026-08-27 and left five dated sections off the page the docs link to. A new file is written
  // locally; a drifted one fails, here and in CI — regenerate with `pnpm vitest run tests/changelog -u`.
  it('matches what CHANGELOG.md renders to', async () => {
    await expect(page()).toMatchFileSnapshot('../../site/changelog.html');
  });

  it('has a section, with an anchor, for every dated heading of CHANGELOG.md', () => {
    const headings = changelog.match(/^## .+$/gm) ?? [];
    const html = page();
    expect(html.match(/<section class="entry">/g)).toHaveLength(headings.length);
    expect(html).toContain('<h2 id="2026-11-17"><a href="#2026-11-17">2026-11-17</a></h2>');
  });

  // A construct the renderer does not know would not fail loudly — it would fold a list into a
  // paragraph and leave its asterisks and backticks on the page. These two catch that.
  it('turns every bullet of CHANGELOG.md into a list item', () => {
    const bullets = changelog.match(/^ *- /gm) ?? [];
    expect(sectionsOf(page()).match(/<li>/g)).toHaveLength(bullets.length);
  });

  it('leaves no Markdown syntax in the rendered text', () => {
    const html = sectionsOf(page());
    expect(html).not.toContain('`');
    expect(html).not.toContain('**');
    expect(html).not.toMatch(/\]\(/);
  });
});

describe('the Markdown renderer', () => {
  it('reads nothing inside a code span as emphasis, and escapes it', () => {
    expect(renderInline('**bold** and `a **b** <c>`')).toBe('<strong>bold</strong> and <code>a **b** &lt;c&gt;</code>');
  });

  it('escapes text, so HTML quoted in an entry shows as text', () => {
    expect(renderInline('a <span> & "b"')).toBe('a &lt;span&gt; &amp; &quot;b&quot;');
  });

  it('sends a repository-relative link to GitHub and keeps the site on the site', () => {
    expect(renderInline('[`docs/routes.md`](docs/routes.md)')).toBe(
      '<a href="https://github.com/LucasHenriqueDiniz/jikan-edge/blob/main/docs/routes.md" target="_blank" rel="noopener"><code>docs/routes.md</code></a>',
    );
    expect(renderInline('[spec](https://jikan.lucashdo.com/openapi.json)')).toBe(
      '<a href="https://jikan.lucashdo.com/openapi.json">spec</a>',
    );
  });

  it('reads *Before:* as italic but leaves a lone asterisk alone', () => {
    expect(renderInline('*Before:* 2 * 3')).toBe('<em>Before:</em> 2 * 3');
  });

  it('lets a list interrupt a paragraph and nests it in its item', () => {
    const html = renderMarkdown(['- **Item.** Affects:', '  - `/a`, which', '    wraps.', '  - `/b`.'].join('\n'));
    expect(html).toBe(
      '<ul>\n<li><strong>Item.</strong> Affects:\n<ul>\n<li><code>/a</code>, which wraps.</li>\n<li><code>/b</code>.</li>\n</ul></li>\n</ul>',
    );
  });

  it('keeps the paragraphs of an item that has several', () => {
    const html = renderMarkdown(['- First.', '', '  Second.', '', '- Next.'].join('\n'));
    expect(html).toBe('<ul>\n<li><p>First.</p>\n<p>Second.</p></li>\n<li><p>Next.</p></li>\n</ul>');
  });
});
