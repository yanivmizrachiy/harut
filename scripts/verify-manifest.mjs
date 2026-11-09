// Fail-closed gate for WORKBOOK_MANIFEST.json (district single-source rule). Proves the
// manifest the district reader consumes is in lockstep with the real pages and the committed
// PDF: 46 contiguous pages each present; chapters cover 1..46 with no gap/overlap; pdf.sha256
// and contentHash match harut.pdf.manifest.json; regeneration is byte-identical (no drift).
import { readFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const fail = (m) => { console.error('verify-manifest: ' + m); process.exitCode = 1; };

const manifest = JSON.parse(readFileSync(join(ROOT, 'WORKBOOK_MANIFEST.json'), 'utf8'));
const pdfManifest = JSON.parse(readFileSync(join(ROOT, 'harut.pdf.manifest.json'), 'utf8'));

if (manifest.schemaVersion !== 3) fail(`schemaVersion ${manifest.schemaVersion} != 3`);
if (manifest.totalPages !== 46) fail(`totalPages ${manifest.totalPages} != 46`);
if (manifest.pages.length !== 46) fail(`pages.length ${manifest.pages.length} != 46`);
if (manifest.cover !== null) fail('cover must be null (no separate cover sheet)');

manifest.pages.forEach((p, i) => {
  if (p.workbookNumber !== i + 1) fail(`page ${i}: workbookNumber ${p.workbookNumber} != ${i + 1}`);
  if (!existsSync(join(ROOT, p.file))) fail(`page file missing: ${p.file}`);
});

let next = 1;
for (const c of manifest.chapters) {
  if (c.startPage !== next) fail(`chapter ${c.id} starts at ${c.startPage}, expected ${next}`);
  if (c.endPage < c.startPage) fail(`chapter ${c.id} end < start`);
  next = c.endPage + 1;
}
if (next !== 47) fail(`chapters end at ${next - 1}, expected 46`);

if (manifest.assets?.fontsCss && !existsSync(join(ROOT, manifest.assets.fontsCss))) fail(`fontsCss missing: ${manifest.assets.fontsCss}`);
for (const css of manifest.assets?.css || []) if (!existsSync(join(ROOT, css))) fail(`css missing: ${css}`);

if (manifest.pdf?.file !== 'harut.pdf' || !existsSync(join(ROOT, 'harut.pdf'))) fail('harut.pdf missing/misdeclared');
if (manifest.pdf?.sha256 !== pdfManifest.pdfSha256) fail('pdf.sha256 != harut.pdf.manifest.json.pdfSha256 (HTML/PDF version mismatch)');
if (manifest.pdf?.pageCount !== pdfManifest.pageCount) fail(`pdf.pageCount ${manifest.pdf?.pageCount} != ${pdfManifest.pageCount}`);
if (manifest.pdf?.coverPages !== 0) fail('pdf.coverPages must be 0');
if (manifest.contentHash !== pdfManifest.sourceDigest) fail('contentHash != sourceDigest (stale version fingerprint)');

const current = readFileSync(join(ROOT, 'WORKBOOK_MANIFEST.json'), 'utf8');
execFileSync(process.execPath, [join(ROOT, 'scripts', 'build-workbook-manifest.mjs')], { cwd: ROOT, stdio: 'ignore' });
const regenerated = readFileSync(join(ROOT, 'WORKBOOK_MANIFEST.json'), 'utf8');
if (current !== regenerated) fail('WORKBOOK_MANIFEST.json out of sync with its generator — run node scripts/build-workbook-manifest.mjs');

if (!process.exitCode) console.log('verify-manifest: OK — 46 pages, 7 chapters, PDF/content hashes in lockstep.');
