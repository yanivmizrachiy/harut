// Build the static public PDF for the Harut workbook (harut.pdf): every page-<n>.html
// rendered as one A4 page into a single same-origin file the district reader downloads.
// Mirrors the galil build. Usage: node scripts/build-pdf.mjs   (run split-pages.mjs first)
import { chromium } from 'playwright';
import { PDFDocument } from 'pdf-lib';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sourceDigest, pdfDigest, MANIFEST } from './pdf-fingerprint.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'harut.pdf');
const mime = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8', '.png':'image/png', '.webp':'image/webp',
  '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.svg':'image/svg+xml', '.woff2':'font/woff2' };

const pages = fs.readdirSync(root).filter((n) => /^page-\d+\.html$/.test(n))
  .map((n) => Number(n.match(/\d+/)[0])).sort((a, b) => a - b);
if (pages.length !== 46) { console.error(`build-pdf: expected 46 pages, found ${pages.length}`); process.exit(1); }

// Hard timeout so a stuck headless run can never hang or leak processes (machine note 2026-09-24).
const hardTimeout = setTimeout(() => { console.error('build-pdf: hard timeout'); process.exit(1); }, 180000);

const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://127.0.0.1').pathname;
  const rel = pathname === '/' ? 'index.html' : pathname.replace(/^\//, '');
  const file = path.resolve(root, decodeURIComponent(rel));
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, buf) => {
    if (err) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': mime[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(buf);
  });
});

let browser;
try {
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/`;
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1200 } });
  const combined = await PDFDocument.create();

  for (const n of pages) {
    await page.goto(`${base}page-${n}.html`, { waitUntil: 'load' });
    await page.evaluate(async () => {
      await document.fonts.ready;
      await Promise.all([...document.images].map((img) => img.complete ? null : new Promise((resolve, reject) => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', () => reject(new Error(`image failed: ${img.getAttribute('src')}`)), { once: true });
      })));
    });
    const bytes = await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' } });
    const one = await PDFDocument.load(bytes);
    if (one.getPageCount() !== 1) throw new Error(`page ${n}: produced ${one.getPageCount()} PDF pages`);
    const [copied] = await combined.copyPages(one, [0]);
    combined.addPage(copied);
  }
  if (combined.getPageCount() !== pages.length) throw new Error(`combined ${combined.getPageCount()} != ${pages.length}`);
  fs.writeFileSync(out, await combined.save());

  const src = sourceDigest(root);
  fs.writeFileSync(path.join(root, MANIFEST), JSON.stringify({
    schemaVersion: 1,
    purpose: 'Deterministic staleness gate for harut.pdf. Derived — regenerate with node scripts/build-pdf.mjs.',
    builtAt: new Date().toISOString(),
    pageCount: combined.getPageCount(),
    inputs: src.files,
    sourceDigest: src.digest,
    pdfSha256: pdfDigest(out),
  }, null, 2) + '\n');
  console.log(`build-pdf: wrote harut.pdf — ${combined.getPageCount()} A4 pages (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
  // Keep WORKBOOK_MANIFEST.json (contentHash + pdf.sha256) in lockstep with this rebuild.
  const { execFileSync } = await import('node:child_process');
  execFileSync(process.execPath, [path.join(root, 'scripts', 'build-workbook-manifest.mjs')], { cwd: root, stdio: 'inherit' });
} finally {
  if (browser) await browser.close();
  await new Promise((r) => server.close(r));
  clearTimeout(hardTimeout);
}
