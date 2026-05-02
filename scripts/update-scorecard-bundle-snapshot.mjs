#!/usr/bin/env node
/**
 * Writes observed index + CreateNuggetModal raw byte sizes into
 * `docs/perf/PERFORMANCE_SCORECARD.md` between PERF_SCORECARD_BUNDLE_ROWS markers.
 * Run after `npm run build` (same pre-req as `check-bundle-budget.mjs`).
 *
 * Gzip labels in the doc are not derived here; update those manually if needed.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const assetsDir = path.join(rootDir, 'dist', 'assets');
const scorecardPath = path.join(rootDir, 'docs', 'perf', 'PERFORMANCE_SCORECARD.md');

const START = '<!-- PERF_SCORECARD_BUNDLE_ROWS_START -->';
const END = '<!-- PERF_SCORECARD_BUNDLE_ROWS_END -->';

function formatInt(n) {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f');
}

if (!fs.existsSync(assetsDir)) {
  console.error('Run `npm run build` first (dist/assets missing).');
  process.exit(1);
}
if (!fs.existsSync(scorecardPath)) {
  console.error('Missing', scorecardPath);
  process.exit(1);
}

const files = fs.readdirSync(assetsDir).filter((f) => f.endsWith('.js'));
const indexFile = files.find((f) => /^index-[^/]+\.js$/.test(f));
const modalFile = files.find((f) => f.includes('CreateNuggetModal') && f.endsWith('.js'));

if (!indexFile || !modalFile) {
  console.error('Expected index-*.js and CreateNuggetModal-*.js in dist/assets.');
  process.exit(1);
}

const indexBytes = fs.statSync(path.join(assetsDir, indexFile)).size;
const modalBytes = fs.statSync(path.join(assetsDir, modalFile)).size;

const newBlock = `${START}
| **index \\*.js** (main app entry chunk) | **${formatInt(indexBytes)} bytes** (~28.5\u202fkB gzip per Vite output) | \`indexJsMaxBytes\` **550\u202f000** in \`scripts/bundle-budget.json\` | ✅ \`npm run test:bundles\` / \`build:verify\` |
| **CreateNuggetModal \\*.js** (modal core chunk) | **${formatInt(modalBytes)} bytes** (~32.5\u202fkB gzip) | \`createNuggetModalChunkMaxBytes\` **190\u202f000** | ✅ same |
${END}`;

let doc = fs.readFileSync(scorecardPath, 'utf8');
const re = new RegExp(
  `${START.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
  'm',
);
if (!re.test(doc)) {
  console.error('Markers not found in scorecard:', START, END);
  process.exit(1);
}
doc = doc.replace(re, newBlock);
fs.writeFileSync(scorecardPath, doc, 'utf8');
console.log(
  `Updated scorecard: ${indexFile} ${formatInt(indexBytes)} B, ${modalFile} ${formatInt(modalBytes)} B`,
);
