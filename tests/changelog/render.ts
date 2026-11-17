// Renders CHANGELOG.md into the site's changelog page, so the page can never fall behind the file.
//
// Why it exists (2026-11-17): `site/changelog.html` was a hand-written mirror of CHANGELOG.md, and
// the mirroring stopped on 2026-08-27 — five dated sections (2026-09-14 to 2026-11-17) never reached
// the page the docs link to. Like `site/openapi.json`, the page is now a committed file a test
// regenerates and compares: this repo has no build step, and Workers Builds publishes the commit.
//
// Only the Markdown CHANGELOG.md actually uses is supported — headings, paragraphs, `---`, bullet
// lists (nested, and items of several paragraphs), code spans, bold, italic and links. No raw HTML:
// every character of text is escaped, so a `<span>` quoted in an entry shows as text.
const REPOSITORY = 'https://github.com/LucasHenriqueDiniz/jikan-edge';
const SITE = 'https://jikan.lucashdo.com';

export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// A relative link in CHANGELOG.md points into the repository (`docs/routes.md`); served from the
// site it would 404, so it goes to the file on GitHub instead.
function linkTarget(url: string): string {
  if (/^[a-z][a-z0-9+.-]*:/i.test(url) || url.startsWith('#')) return url;
  return `${REPOSITORY}/blob/main/${url.replace(/^\.\//, '')}`;
}

function link(label: string, url: string): string {
  const target = linkTarget(url);
  const leavesSite = /^https?:/.test(target) && !target.startsWith(SITE);
  return `<a href="${target}"${leavesSite ? ' target="_blank" rel="noopener"' : ''}>${label}</a>`;
}

/**
 * Code spans are set aside before anything else, behind a private-use character no text holds, so
 * nothing inside backticks is read as emphasis or a link; they come back escaped at the end. A code
 * span may cross a line break in the source — paragraphs reach this function already joined.
 */
export function renderInline(text: string): string {
  const spans: string[] = [];
  const held = text.replace(/`([^`]+)`/g, (_, code: string) => `\uE000${spans.push(code) - 1}\uE000`);
  const html = escapeHtml(held)
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, label: string, url: string) => link(label, url))
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\s](?:[^*]*[^*\s])?)\*/g, '<em>$1</em>');
  return html.replace(/\uE000(\d+)\uE000/g, (_, index: string) => `<code>${escapeHtml(spans[Number(index)])}</code>`);
}

export function slug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function groupClass(text: string): string {
  const kind = /breaking|added|fixed|changed|removed/i.exec(text)?.[0].toLowerCase();
  return kind ? `group-label ${kind}` : 'group-label';
}

function heading(level: number, text: string): string {
  if (level === 2) {
    const id = slug(text);
    return `<h2 id="${id}"><a href="#${id}">${renderInline(text)}</a></h2>`;
  }
  if (level === 3) return `<h3 class="${groupClass(text)}">${renderInline(text)}</h3>`;
  return `<h${level}>${renderInline(text)}</h${level}>`;
}

const isBlank = (line: string) => line.trim() === '';
const startsBlock = (line: string) => /^(#{1,6} |- )/.test(line) || /^-{3,}$/.test(line.trim());

/**
 * A list at column 0 — nested lists reach here already dedented by their parent item. An item runs
 * while its lines are indented two spaces; a blank line continues the list only when what follows is
 * indented or is the next item. A list with a blank line anywhere in it is loose, and its items keep
 * their paragraphs; a tight item is bare text.
 */
function list(lines: string[], start: number): [string, number] {
  const items: string[][] = [];
  let loose = false;
  let i = start;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('- ')) {
      items.push([line.slice(2)]);
      i += 1;
    } else if (isBlank(line)) {
      let next = i;
      while (next < lines.length && isBlank(lines[next])) next += 1;
      if (next === lines.length || !(lines[next].startsWith('  ') || lines[next].startsWith('- '))) break;
      loose = true;
      items[items.length - 1].push(...lines.slice(i, next).map(() => ''));
      i = next;
    } else if (line.startsWith('  ')) {
      items[items.length - 1].push(line.slice(2));
      i += 1;
    } else {
      break;
    }
  }
  const rendered = items.map((item) => {
    const body = blocks(item);
    return `<li>${loose ? body : body.replace(/^<p>([\s\S]*?)<\/p>/, '$1')}</li>`;
  });
  return [`<ul>\n${rendered.join('\n')}\n</ul>`, i];
}

export function blocks(lines: string[]): string {
  const out: string[] = [];
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    const title = /^(#{1,6}) (.+)$/.exec(line);
    if (isBlank(line)) {
      i += 1;
    } else if (title) {
      out.push(heading(title[1].length, title[2].trim()));
      i += 1;
    } else if (/^-{3,}$/.test(line.trim())) {
      out.push('<hr>');
      i += 1;
    } else if (line.startsWith('- ')) {
      const [html, next] = list(lines, i);
      out.push(html);
      i = next;
    } else {
      const paragraph = [line.trim()];
      i += 1;
      while (i < lines.length && !isBlank(lines[i]) && !startsBlock(lines[i])) {
        paragraph.push(lines[i].trim());
        i += 1;
      }
      out.push(`<p>${renderInline(paragraph.join(' '))}</p>`);
    }
  }
  return out.join('\n');
}

export function renderMarkdown(source: string): string {
  return blocks(source.replace(/\r\n/g, '\n').split('\n'));
}

interface Section {
  title: string;
  body: string[];
}

function sections(source: string): { intro: string[]; dated: Section[] } {
  const lines = source.replace(/\r\n/g, '\n').split('\n');
  const intro: string[] = [];
  const dated: Section[] = [];
  for (const line of lines) {
    const title = /^## (.+)$/.exec(line);
    if (title) dated.push({ title: title[1].trim(), body: [] });
    else if (dated.length > 0) dated[dated.length - 1].body.push(line);
    else if (!/^# /.test(line)) intro.push(line);
  }
  return { intro, dated };
}

/** The whole page: the template with CHANGELOG.md's intro, a list of its dates, and every section. */
export function renderChangelogPage(source: string, template: string): string {
  const { intro, dated } = sections(source);
  const toc = dated.map(({ title }) => `<li><a href="#${slug(title)}">${renderInline(title)}</a></li>`);
  const entries = dated.map(
    ({ title, body }) => `<section class="entry">\n${heading(2, title)}\n${blocks(body)}\n</section>`,
  );
  return fill(template, {
    intro: blocks(intro),
    toc: `<ul>\n${toc.join('\n')}\n</ul>`,
    sections: entries.join('\n\n'),
  });
}

// split/join rather than `replace`, which would read a `$&` or `$1` in an entry as a pattern.
function fill(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce((page, [name, value]) => {
    const slot = `<!-- ${name} -->`;
    if (page.split(slot).length !== 2) throw new Error(`template must hold ${slot} exactly once`);
    return page.split(slot).join(value);
  }, template);
}
