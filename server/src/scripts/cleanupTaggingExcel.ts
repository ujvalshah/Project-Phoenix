/**
 * Cleanup Tagging Excel — Normalizes the user-edited Excel before import
 *
 * Fixes:
 * 1. Typos: "Tecnology" → "Technology"
 * 2. Non-canonical subtopics: "Private Equity" → "PE/VC", "PE / VC" → "PE/VC"
 * 3. Values in wrong dimension: "Macro / Economics" in subtopic → moved to domain
 * 4. Removed subtopics: "Policy", "Software", "History" (as subtopic) → cleared
 * 5. Multi-format rows: flagged in a "review_notes" column
 * 6. Comma-separated values → semicolon-separated
 *
 * Usage: tsx server/src/scripts/cleanupTaggingExcel.ts <input.xlsx> [output.xlsx]
 */

import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

// ─── Canonical values ─────────────────────────────────────────────────────────

const VALID_FORMATS = new Set([
  'Podcast', 'Report / Insights', 'Documentary', 'Knowledge Bytes',
]);

const VALID_DOMAINS = new Set([
  'Markets & Investments', 'Technology', 'Macro / Economics',
  'Geopolitics', 'History', 'Leaders, Investors & Entrepreneurs',
  'Self-Development',
]);

const VALID_SUBTOPICS = new Set([
  'US', 'India', 'China', 'Japan', 'Korea', 'Europe', 'Emerging Markets',
  'LATAM', 'US / West', 'Middle East', 'Russia',
  'Equity', 'Gold & Silver', 'Private Credit', 'Alternatives',
  'Currencies & FX', 'Fixed Income',
  'AI', 'Semiconductors', 'PE/VC', 'Monetary Policy', 'Commodities',
  'Crude Oil & Energy',
]);

// ─── Normalization maps ───────────────────────────────────────────────────────

// Subtopic corrections: non-canonical → canonical (or null to remove)
const SUBTOPIC_FIXES: Record<string, string | null> = {
  'Tecnology': null,         // Typo in subtopic — it's a domain, remove from subtopic
  'Technology': null,        // Domain, not subtopic
  'Macro / Economics': null, // Domain, not subtopic
  'Markets': null,           // Domain, not subtopic
  'Geopolitics': null,       // Domain, not subtopic
  'Investing': null,         // Domain-level concept (Markets & Investments)
  'Policy': null,            // Removed per user decision
  'Software': null,          // Removed per user decision
  'Conflict': null,          // Not a canonical subtopic
  'History': null,           // Only a domain, not subtopic per user decision
  'Private Equity': 'PE/VC', // Remap
  'PE / VC': 'PE/VC',        // Spacing fix
};

// Domain corrections
const DOMAIN_FIXES: Record<string, string> = {
  'Tecnology': 'Technology',
  'Self-Development, Leaders, Investors & Entrepreneurs': 'Self-Development; Leaders, Investors & Entrepreneurs',
  'Leaders, Investors & Entrepreneurs': 'Leaders, Investors & Entrepreneurs', // identity — avoid split on comma
};

// Format corrections
const FORMAT_FIXES: Record<string, string> = {
  'Podcast, Knowledge Bytes': 'Podcast',  // Comma-separated → pick first
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function splitSemicolon(val: string): string[] {
  return val.split(';').map(s => s.trim()).filter(Boolean);
}

/**
 * Smart split that respects "Leaders, Investors & Entrepreneurs" as a single value.
 * Splits on "; " (semicolon-space) first, then falls back to ";" without space.
 */
function smartSplitDomain(val: string): string[] {
  // Handle known composite names first
  const knownComposites = ['Leaders, Investors & Entrepreneurs'];
  const placeholders: [string, string][] = [];
  let working = val;

  for (const composite of knownComposites) {
    if (working.includes(composite)) {
      const placeholder = `__COMPOSITE_${placeholders.length}__`;
      placeholders.push([placeholder, composite]);
      working = working.replace(composite, placeholder);
    }
  }

  const parts = working.split(';').map(s => s.trim()).filter(Boolean);

  return parts.map(part => {
    for (const [ph, orig] of placeholders) {
      if (part.includes(ph)) return part.replace(ph, orig);
    }
    return part;
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: tsx server/src/scripts/cleanupTaggingExcel.ts <input.xlsx> [output.xlsx]');
    process.exit(1);
  }

  const inputPath = args[0];
  const outputPath = args[1] || inputPath.replace(/\.xlsx$/i, '_cleaned.xlsx');

  console.log(`Reading: ${inputPath}`);
  const wb = XLSX.readFile(inputPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json<Record<string, string>>(ws);
  console.log(`Rows: ${data.length}\n`);

  let formatFixes = 0;
  let domainFixes = 0;
  let subtopicFixes = 0;
  let multiFormatFlags = 0;
  const fixLog: string[] = [];

  const cleaned = data.map((row, idx) => {
    const rowNum = idx + 2; // Excel row (header = 1)
    const notes: string[] = [];

    // ── Fix format ──────────────────────────────────────────────────────
    let fmt = (row.suggested_format || '').trim();

    // Apply known fixes
    if (FORMAT_FIXES[fmt]) {
      fixLog.push(`Row ${rowNum}: Format "${fmt}" → "${FORMAT_FIXES[fmt]}"`);
      fmt = FORMAT_FIXES[fmt];
      formatFixes++;
    }

    // Fix comma-separated formats → semicolons
    if (fmt.includes(',') && !fmt.includes(';')) {
      const fixed = fmt.split(',').map(s => s.trim()).filter(Boolean).join('; ');
      fixLog.push(`Row ${rowNum}: Format comma→semicolon: "${fmt}" → "${fixed}"`);
      fmt = fixed;
      formatFixes++;
    }

    // Validate each format part
    const fmtParts = splitSemicolon(fmt);
    const validFmtParts: string[] = [];
    for (const part of fmtParts) {
      if (VALID_FORMATS.has(part)) {
        if (!validFmtParts.includes(part)) validFmtParts.push(part);
      } else {
        notes.push(`UNKNOWN format: "${part}"`);
      }
    }
    fmt = validFmtParts.join('; ');

    // ── Fix domain ──────────────────────────────────────────────────────
    let domainStr = (row.suggested_domain || '').trim();

    // Apply known composite fixes first
    if (DOMAIN_FIXES[domainStr]) {
      if (DOMAIN_FIXES[domainStr] !== domainStr) {
        fixLog.push(`Row ${rowNum}: Domain "${domainStr}" → "${DOMAIN_FIXES[domainStr]}"`);
        domainFixes++;
      }
      domainStr = DOMAIN_FIXES[domainStr];
    }

    const domainParts = smartSplitDomain(domainStr);
    const cleanedDomains: string[] = [];

    for (const d of domainParts) {
      const fixed = DOMAIN_FIXES[d];
      if (fixed && fixed !== d) {
        fixLog.push(`Row ${rowNum}: Domain part "${d}" → "${fixed}"`);
        domainFixes++;
        // The fix might contain semicolons (splitting into multiple domains)
        smartSplitDomain(fixed).forEach(fd => {
          if (VALID_DOMAINS.has(fd) && !cleanedDomains.includes(fd)) cleanedDomains.push(fd);
        });
      } else if (VALID_DOMAINS.has(d)) {
        if (!cleanedDomains.includes(d)) cleanedDomains.push(d);
      } else {
        notes.push(`UNKNOWN domain: "${d}"`);
      }
    }

    // ── Fix subtopic ────────────────────────────────────────────────────
    const subParts = splitSemicolon((row.suggested_subtopic || '').trim());
    const cleanedSubs: string[] = [];

    for (const s of subParts) {
      if (SUBTOPIC_FIXES[s] !== undefined) {
        const replacement = SUBTOPIC_FIXES[s];
        if (replacement === null) {
          fixLog.push(`Row ${rowNum}: Subtopic "${s}" → removed`);
          subtopicFixes++;
        } else {
          fixLog.push(`Row ${rowNum}: Subtopic "${s}" → "${replacement}"`);
          if (!cleanedSubs.includes(replacement)) cleanedSubs.push(replacement);
          subtopicFixes++;
        }
      } else if (VALID_SUBTOPICS.has(s)) {
        if (!cleanedSubs.includes(s)) cleanedSubs.push(s);
      } else {
        notes.push(`UNKNOWN subtopic: "${s}"`);
      }
    }

    return {
      ...row,
      suggested_format: fmt,
      suggested_domain: cleanedDomains.join('; '),
      suggested_subtopic: cleanedSubs.join('; '),
      review_notes: notes.join(' | ') || '',
    };
  });

  // ── Write output ──────────────────────────────────────────────────────────
  const outWs = XLSX.utils.json_to_sheet(cleaned);
  const outWb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(outWb, outWs, 'nugget_tag_mapping_cleaned');
  XLSX.utils.book_append_sheet(outWb, XLSX.utils.aoa_to_sheet(
    [['Fix Log'], ...fixLog.map(l => [l])]
  ), 'Fix Log');

  XLSX.writeFile(outWb, outputPath);

  console.log('=== Cleanup Summary ===');
  console.log(`Format fixes:    ${formatFixes}`);
  console.log(`Domain fixes:    ${domainFixes}`);
  console.log(`Subtopic fixes:  ${subtopicFixes}`);
  console.log(`Multi-format:    ${multiFormatFlags} (kept first, flagged for review)`);
  console.log(`\nOutput: ${outputPath}`);
  console.log(`Fix log in sheet 2 of the output file.`);
}

main();
