// Single-source derivation for the Jerusalem district native reader.
// index.html is the ONE authored source (46 <main class="a4-page"> sheets in one file).
// This splits it into standalone page-<n>.html files the district reader (jerusalem2
// NativeWorkbookReader) fetches per page from this repo's GitHub Pages origin — no second
// hand-maintained copy of the content: edit index.html, re-run, and the pages regenerate.
//
// Each emitted page is a complete HTML document carrying index.html's own <head> (so the
// same styles.css + reader-fonts apply) with a per-page <title> taken from the sheet, and
// exactly one <main class="a4-page">. Run: node scripts/split-pages.mjs
import { readFileSync, writeFileSync, readdirSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(ROOT, 'index.html'), 'utf8');

// index.html's <head> inner, reused verbatim for every page (shared styles + fonts).
const headInner = (html.match(/<head>([\s\S]*?)<\/head>/) || [, ''])[1]
  .replace(/<title>[\s\S]*?<\/title>\s*/i, ''); // per-page title is injected instead

const mains = html.match(/<main\b[\s\S]*?<\/main>/g) || [];
if (mains.length !== 46) throw new Error(`expected 46 <main> sheets, found ${mains.length}`);

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const titleOf = (block, n) => {
  let t = (block.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [])[1];
  if (!t) t = (block.match(/class="visually-hidden"[^>]*>([\s\S]*?)<\/span>/) || [])[1];
  t = (t || '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  return t || `חרוט — עמוד ${n}`;
};

// Remove any previously-generated page files so a deleted/renumbered sheet never lingers.
for (const f of readdirSync(ROOT)) if (/^page-\d+\.html$/.test(f)) unlinkSync(join(ROOT, f));

const written = [];
for (const block of mains) {
  const n = Number((block.match(/data-local-page="(\d+)"/) || [])[1]);
  if (!n) throw new Error('a <main> sheet has no data-local-page');
  const doc = `<!doctype html>\n<html lang="he" dir="rtl">\n<head>\n<title>${esc(titleOf(block, n))}</title>${headInner}</head>\n<body>\n${block}\n</body>\n</html>\n`;
  writeFileSync(join(ROOT, `page-${n}.html`), doc);
  written.push(n);
}
written.sort((a, b) => a - b);
const gaps = written.filter((n, i) => n !== i + 1);
if (written.length !== 46 || gaps.length) throw new Error(`pages not contiguous 1..46: ${written.join(',')}`);
console.log(`split-pages: wrote page-1.html..page-46.html (46 sheets) from index.html.`);
