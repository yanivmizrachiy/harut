// Shared fingerprint of everything that renders into harut.pdf.
// Deterministic: sorted file list, sha256 per file, sha256 over "path:sha" lines. No browser.
// The authored SOURCE is index.html (+ styles + fonts + visual assets); page-<n>.html are
// derived by split-pages.mjs, so fingerprinting the source inputs detects every real change.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export const MANIFEST = 'harut.pdf.manifest.json';
const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');

function walk(dir, rel, out) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir).sort()) {
    const full = path.join(dir, name), r = rel ? `${rel}/${name}` : name;
    if (fs.statSync(full).isDirectory()) walk(full, r, out); else out.push(r);
  }
}

export function sourceFiles(root) {
  const files = ['index.html', 'styles.css', 'styles/reader-fonts.css'];
  walk(path.join(root, 'assets/fonts'), 'assets/fonts', files);
  walk(path.join(root, 'visual-assets'), 'visual-assets', files);
  return files.filter((f) => fs.existsSync(path.join(root, f)));
}

export function sourceDigest(root) {
  const files = {};
  for (const f of sourceFiles(root)) files[f] = sha256(fs.readFileSync(path.join(root, f)));
  const digest = sha256(Object.entries(files).map(([f, h]) => `${f}:${h}`).join('\n'));
  return { files, digest };
}

export const pdfDigest = (pdfPath) => sha256(fs.readFileSync(pdfPath));
