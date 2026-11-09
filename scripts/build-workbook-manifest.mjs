// Build WORKBOOK_MANIFEST.json (schemaVersion 3) — the registry the Jerusalem district
// shared native reader (jerusalem2 NativeWorkbookReader) consumes to display this workbook's
// 46 HTML pages directly from this repo's GitHub Pages origin, with no second copy.
//
// DERIVED file: contentHash + pdf.sha256 come from harut.pdf.manifest.json so the district
// reader can prove the HTML pages and the downloadable PDF are the same version.
// Regenerate with: node scripts/build-workbook-manifest.mjs (checked by scripts/verify-manifest.mjs)
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const pdfManifest = JSON.parse(readFileSync(join(ROOT, 'harut.pdf.manifest.json'), 'utf8'));

const pageFiles = readdirSync(ROOT)
  .filter((f) => /^page-\d+\.html$/.test(f))
  .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
if (pageFiles.length !== 46) throw new Error(`expected 46 page-N.html, found ${pageFiles.length}`);

const titleOf = (file) => {
  const t = readFileSync(join(ROOT, file), 'utf8').match(/<title>([^<]*)<\/title>/);
  return t ? t[1].trim() : '';
};

// Chapters = the pedagogical arc already present in the sheets. startPage/endPage are the
// workbook page numbers (1–46). Gentle, distinct TOC accents from the district palette.
const chapters = [
  { id: 'recognition', title: 'זיהוי החרוט והמחשה', startPage: 1, endPage: 7, color: '#2563eb', tint: '#eff6ff' },
  { id: 'nets', title: 'פריסות וחתכים', startPage: 8, endPage: 11, color: '#0f766e', tint: '#ecfdf5' },
  { id: 'volume', title: 'נפח החרוט', startPage: 12, endPage: 17, color: '#7c3aed', tint: '#f5f3ff' },
  { id: 'axial', title: 'חתך צירי ופיתגורס', startPage: 18, endPage: 22, color: '#c2410c', tint: '#fff7ed' },
  { id: 'applications', title: 'יישומים והמרת מידות', startPage: 23, endPage: 29, color: '#15803d', tint: '#f0fdf4' },
  { id: 'synthesis', title: 'משימות מסכמות והערכה', startPage: 30, endPage: 43, color: '#be123c', tint: '#fff1f2' },
  { id: 'reference', title: 'מחסן מילים ותשובות', startPage: 44, endPage: 46, color: '#a16207', tint: '#fefce8' },
];
const chapterOf = (n) => chapters.find((c) => n >= c.startPage && n <= c.endPage).id;

const pages = pageFiles.map((file, i) => ({ file, workbookNumber: i + 1, chapterId: chapterOf(i + 1), title: titleOf(file) }));

const manifest = {
  schemaVersion: 3,
  id: 'harut',
  name: 'חוברת החרוט',
  author: 'יניב רז',
  credit: [
    'יניב רז - מדריך מחוזי חט״ב בעיר ירושלים',
    'הדרכה במחוז ירושלים והעיר ירושלים - מנח״י, בהובלת איילת קריספין',
  ],
  totalPages: pages.length,
  cover: null,
  pageSelector: 'main.a4-page',
  assets: {
    css: ['styles.css'],
    pageCssPattern: null,
    fontsCss: 'styles/reader-fonts.css',
    mathjax: null, // this workbook renders math as HTML/Unicode (math-ltr), no MathJax
    mathjaxFontRoot: null,
  },
  pages,
  chapters,
  pdf: {
    file: 'harut.pdf',
    pageCount: pdfManifest.pageCount, // 46 (no separate cover sheet)
    sha256: pdfManifest.pdfSha256,
    coverPages: 0, // content page k ↔ PDF page k
  },
  contentHash: pdfManifest.sourceDigest,
  builtAt: pdfManifest.builtAt,
  version: JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version || '0.0.0',
};

writeFileSync(join(ROOT, 'WORKBOOK_MANIFEST.json'), JSON.stringify(manifest, null, 2) + '\n');
console.log(`WORKBOOK_MANIFEST.json written: ${pages.length} pages, ${chapters.length} chapters, pdf ${manifest.pdf.pageCount}pp.`);
