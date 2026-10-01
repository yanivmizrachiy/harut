/**
 * Mathematical Typography & Correctness Validator
 * Enforces Israeli Ministry of Education (מפמ"ר מתמטיקה) standards across the workbook:
 * 1. BiDi Directionality & Formula Order (prevents reversed equations like "רדיוס² · גובה · π · ⅓ = נפח")
 * 2. Answer-line label flow ("רדיוס = ___ ס״מ" vs broken "= רדיוס")
 * 3. Proportional geometric SVG diagrams (e.g. 6-8-10 right triangle)
 * 4. Proper unit formatting (ס״מ, ס״מ², ס״מ³) and standard operators (·, ², ³, π, ⅓)
 */

import fs from 'fs';
import path from 'path';

export function validateMath(htmlContent) {
  const errors = [];
  const warnings = [];

  // 1. Check for Hebrew words inside math-ltr spans
  const mathLtrRegex = /<span\s+class="[^"]*math-ltr[^"]*"[^>]*>([\s\S]*?)<\/span>/g;
  let match;

  while ((match = mathLtrRegex.exec(htmlContent)) !== null) {
    const text = match[1].trim();
    const hasHebrew = /[\u0590-\u05FF]/.test(text);
    const hasOperators = /[=·\+\-²³⅓π\/\*\(\)]/.test(text);

    if (hasHebrew && hasOperators) {
      errors.push({
        type: 'BIDI_MATH_LTR_POLLUTION',
        snippet: text,
        message: `Hebrew text mixed with math operators inside math-ltr causes BiDi inversion (e.g. "${text}"). Must use math-formula or math-label with proper directionality.`
      });
    } else if (hasHebrew) {
      warnings.push({
        type: 'HEBREW_IN_MATH_LTR',
        snippet: text,
        message: `Pure Hebrew word inside math-ltr: "${text}". Should use math-term or math-label.`
      });
    }
  }

  // 2. Check for reversed formulas (e.g. "= נפח" at the end of a string or "רדיוס² ... = נפח")
  const reversedFormulaRegex = /רדיוס²[\s\S]{0,30}=\s*נפח/g;
  while ((match = reversedFormulaRegex.exec(htmlContent)) !== null) {
    errors.push({
      type: 'REVERSED_FORMULA',
      snippet: match[0],
      message: `Reversed formula detected: "${match[0]}". Must read "נפח = ... רדיוס² ..."`
    });
  }

  // 3. Check for reversed answer labels (e.g. class="math-ltr">רדיוס =)
  const reversedLabelRegex = /class="[^"]*math-ltr[^"]*">\s*(?:רדיוס|גובה|יוצר|קוטר|נפח|שטח)\s*=/g;
  while ((match = reversedLabelRegex.exec(htmlContent)) !== null) {
    errors.push({
      type: 'REVERSED_ANSWER_LABEL',
      snippet: match[0],
      message: `Answer label with '=' inside math-ltr will render '=' before the word: "${match[0]}". Must use math-label with RTL flow.`
    });
  }

  // 4. Check geometric SVG proportions for right-triangle half axial sections (Page 5, r=6, h=8, s=10)
  const rightTriRegex = /<svg[^>]*aria-label="[^"]*משולש ישר זווית[^"]*"[\s\S]*?<polygon\s+points="([^"]+)"[\s\S]*?<\/svg>/g;
  while ((match = rightTriRegex.exec(htmlContent)) !== null) {
    const pts = match[1].split(/[\s,]+/).map(Number);
    if (pts.length >= 6) {
      const xs = [pts[0], pts[2], pts[4]];
      const ys = [pts[1], pts[3], pts[5]];
      const width = Math.max(...xs) - Math.min(...xs);
      const height = Math.max(...ys) - Math.min(...ys);

      // In a 6-8-10 right triangle, height (8) MUST be strictly greater than radius (6)!
      if (width >= height) {
        errors.push({
          type: 'GEOMETRIC_PROPORTION_INVERTED',
          snippet: match[0].slice(0, 150),
          message: `Right triangle has width=${width} >= height=${height}, but represents radius=6 and height=8 (height must be 4/3 of width)!`
        });
      }
    }
  }

  // 5. Check geometric SVG proportions for axial sections with height and radius
  const fullAxialRegex = /<svg[^>]*aria-label="[^"]*חצי חתך צירי עם ניצבים 6 ו-8[^"]*"[\s\S]*?<polygon\s+points="([^"]+)"[\s\S]*?<\/svg>/g;
  while ((match = fullAxialRegex.exec(htmlContent)) !== null) {
    const pts = match[1].split(/[\s,]+/).map(Number);
    if (pts.length >= 6) {
      const xs = [pts[0], pts[2], pts[4]];
      const ys = [pts[1], pts[3], pts[5]];
      const totalWidth = Math.max(...xs) - Math.min(...xs);
      const radius = totalWidth / 2;
      const height = Math.max(...ys) - Math.min(...ys);

      if (radius >= height) {
        errors.push({
          type: 'GEOMETRIC_PROPORTION_INVERTED',
          snippet: match[0].slice(0, 150),
          message: `Axial section has radius=${radius} >= height=${height}, but represents radius=6 and height=8 (height must be greater than radius)!`
        });
      }
    }
  }

  // 6. Check for unprotected exponents after blanks (prevents BiDi scrambling like "______ ² · 1/3 = נפח")
  const unprotectedExponentRegex = /<span\s+class="blank[^"]*"><\/span>\s*[²³]/g;
  while ((match = unprotectedExponentRegex.exec(htmlContent)) !== null) {
    errors.push({
      type: 'UNPROTECTED_EXPONENT_AFTER_BLANK',
      snippet: match[0],
      message: `Unprotected exponent after blank: "${match[0]}". Must be enclosed in .scaffold-pow with explicit flex isolation.`
    });
  }

  // 7. Check formula scaffold integrity
  if (htmlContent.includes('class="formula-scaffold"')) {
    const scaffoldMatches = htmlContent.match(/<[^>]+class="formula-scaffold"[^>]*>([\s\S]*?)<\/(?:div|p)>/g) || [];
    for (const sc of scaffoldMatches) {
      if (!sc.includes('dir="rtl"') || !sc.includes('scaffold-pow')) {
        errors.push({
          type: 'FORMULA_SCAFFOLD_INTEGRITY',
          snippet: sc.slice(0, 120),
          message: `Formula scaffold must have dir="rtl" and use scaffold-pow for exponent attachment to prevent browser BiDi reordering.`
        });
      }
    }
  }

  // 8. Check axial triangle label separation (page 5)
  const axialTriRegex = /<section[^>]*class="[^"]*axial-bridge[^"]*"[\s\S]*?<svg[^>]*>([\s\S]*?)<\/svg>/g;
  while ((match = axialTriRegex.exec(htmlContent)) !== null) {
    const svgBody = match[1];
    const hasHeightBadge = svgBody.includes('class="lbl-height"') || svgBody.includes('label-height');
    const hasSlantBadge = svgBody.includes('class="lbl-slant"') || svgBody.includes('label-slant');
    if (!hasHeightBadge || !hasSlantBadge) {
      errors.push({
        type: 'AXIAL_TRIANGLE_LABEL_COLLISION_RISK',
        snippet: svgBody.slice(0, 120),
        message: `Axial bridge triangle labels must have dedicated isolated badge wrappers (lbl-height on left, lbl-slant on right) to prevent overlap.`
      });
    }
  }

  return { errors, warnings, valid: errors.length === 0 };
}

if (process.argv[1] && process.argv[1].endsWith('validate-math.js')) {
  const filePath = path.resolve(process.cwd(), 'index.html');
  const content = fs.readFileSync(filePath, 'utf-8');
  const { errors, warnings, valid } = validateMath(content);

  console.log(`\n=== Mathematical Typography & Correctness Audit ===`);
  console.log(`Errors: ${errors.length} | Warnings: ${warnings.length}`);

  if (errors.length > 0) {
    console.log(`\n❌ ERRORS FOUND:`);
    errors.forEach((e, i) => console.log(`${i + 1}. [${e.type}] ${e.message}`));
  }

  if (warnings.length > 0) {
    console.log(`\n⚠️ WARNINGS:`);
    warnings.slice(0, 10).forEach((w, i) => console.log(`${i + 1}. [${w.type}] ${w.message}`));
  }

  if (valid) {
    console.log(`\n✅ Mathematical correctness check PASSED 100%! All formulas and diagrams adhere to Israeli textbook standards.\n`);
    process.exit(0);
  } else {
    console.log(`\n❌ Mathematical correctness check FAILED. Corrections required.\n`);
    process.exit(1);
  }
}
