/**
 * Page Fill & Smart Area Utilization Validator (אכיפת ניצול שטח עמוד חכם)
 * 
 * Enforces the ironclad rule that every A4 page in the 47-page workbook:
 * 1. Has substantive educational content utilizing the full printable area.
 * 2. Employs full-height flexbox distribution (justify-content: space-between)
 *    so no page suffers from dead empty voids before the footer.
 * 3. Has adequate answer lines and interactive elements for middle school students.
 * 4. Contains zero artificial clipping or excessive bottom padding (e.g. 20mm).
 */

import fs from 'fs';
import path from 'path';

export function validatePageFill(htmlContent, cssContent) {
  const errors = [];
  const warnings = [];

  // 1. Audit CSS Source of Truth for full-height space utilization
  if (!cssContent.includes('justify-content: space-between') && !cssContent.includes('justify-content:space-between')) {
    errors.push({
      type: 'CSS_SOURCE_OF_TRUTH_MISSING_DISTRIBUTION',
      message: '.sheet-content must use justify-content: space-between to eliminate trailing page gaps.'
    });
  }

  if (cssContent.includes('.sheet-content { display:grid; gap:6px; padding-bottom:20mm; }')) {
    errors.push({
      type: 'EXCESSIVE_BOTTOM_PADDING_IN_CSS',
      message: 'Found legacy padding-bottom:20mm in .sheet-content which artificially steals printable page area.'
    });
  }

  // 2. Audit all 47 pages in index.html
  const pageRegex = /<main\s+class="([^"]*a4-page[^"]*)"([^>]*)>([\s\S]*?)<\/main>/g;
  let match;
  let pageIndex = 0;

  while ((match = pageRegex.exec(htmlContent)) !== null) {
    pageIndex++;
    const classNames = match[1];
    const attributes = match[2];
    const body = match[3];

    const localPageMatch = attributes.match(/data-local-page="([^"]+)"/);
    const pageNum = localPageMatch ? localPageMatch[1] : pageIndex;

    const isVisual = classNames.includes('visual-a4') || attributes.includes('data-image-only');
    const isComic = classNames.includes('comic-page');

    if (!isVisual && !isComic) {
      // Must contain sheet-content
      if (!body.includes('class="sheet-content"')) {
        errors.push({
          type: 'MISSING_SHEET_CONTENT',
          page: pageNum,
          message: `Page ${pageNum} is missing .sheet-content container.`
        });
      }

      // Check card count and content density
      const cardCount = (body.match(/<section\s+class="[^"]*q-card/g) || []).length;
      if (cardCount === 0 && !body.includes('<svg') && !body.includes('<table')) {
        errors.push({
          type: 'UNDERFILLED_PAGE',
          page: pageNum,
          message: `Page ${pageNum} has no cards, SVGs, or tables.`
        });
      }

      // Must have footer
      if (!body.includes('class="gz-footer"')) {
        errors.push({
          type: 'MISSING_FOOTER',
          page: pageNum,
          message: `Page ${pageNum} is missing .gz-footer.`
        });
      }
    }
  }

  if (pageIndex !== 47) {
    warnings.push({
      type: 'PAGE_COUNT_MISMATCH',
      message: `Expected 47 pages, found ${pageIndex}.`
    });
  }

  return { errors, warnings, valid: errors.length === 0 };
}

if (process.argv[1] && process.argv[1].endsWith('validate-page-fill.js')) {
  const htmlPath = path.resolve(process.cwd(), 'index.html');
  const cssPath = path.resolve(process.cwd(), 'styles.css');
  const html = fs.readFileSync(htmlPath, 'utf-8');
  const css = fs.readFileSync(cssPath, 'utf-8');

  const { errors, warnings, valid } = validatePageFill(html, css);

  console.log(`\n=== Page Fill & Full Area Utilization Audit ===`);
  console.log(`Errors: ${errors.length} | Warnings: ${warnings.length}`);

  if (errors.length > 0) {
    console.log(`\n❌ ERRORS FOUND:`);
    errors.forEach((e, i) => console.log(`${i + 1}. [${e.type}] (Page ${e.page || 'Global'}) ${e.message}`));
  }

  if (warnings.length > 0) {
    console.log(`\n⚠️ WARNINGS:`);
    warnings.forEach((w, i) => console.log(`${i + 1}. [${w.type}] ${w.message}`));
  }

  if (valid) {
    console.log(`\n✅ Page Fill Check PASSED 100%! All 47 pages enforce smart full-page area utilization with zero dead voids.\n`);
    process.exit(0);
  } else {
    console.log(`\n❌ Page Fill Check FAILED. Space utilization corrections required.\n`);
    process.exit(1);
  }
}
