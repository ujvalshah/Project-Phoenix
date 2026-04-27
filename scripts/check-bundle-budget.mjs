#!/usr/bin/env node
/**
 * Fails the build if the main Vite `index-*.js` or `CreateNuggetModal-*.js` output grows past budget.
 * Tune limits in `scripts/bundle-budget.json`.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const assetsDir = path.join(rootDir, 'dist', 'assets');
const configPath = path.join(__dirname, 'bundle-budget.json');

if (!fs.existsSync(configPath)) {
  console.error('Missing', configPath);
  process.exit(1);
}
const { indexJsMaxBytes, createNuggetModalChunkMaxBytes } = JSON.parse(
  fs.readFileSync(configPath, 'utf8'),
);

if (!fs.existsSync(assetsDir)) {
  console.error('Run `npm run build` first (dist/assets missing).');
  process.exit(1);
}

const files = fs.readdirSync(assetsDir).filter((f) => f.endsWith('.js'));
const indexFile = files.find((f) => /^index-[^/]+\.js$/.test(f));
const modalFile = files.find((f) => f.includes('CreateNuggetModal') && f.endsWith('.js'));

if (!indexFile) {
  console.error('No index-*.js in dist/assets (check Vite build output).');
  process.exit(1);
}
if (!modalFile) {
  console.error('No CreateNuggetModal-*.js in dist/assets (check Vite build output).');
  process.exit(1);
}

const indexPath = path.join(assetsDir, indexFile);
const modalPath = path.join(assetsDir, modalFile);
const indexBytes = fs.statSync(indexPath).size;
const modalBytes = fs.statSync(modalPath).size;

const rows = [
  { label: 'index bundle', name: indexFile, bytes: indexBytes, max: indexJsMaxBytes },
  { label: 'CreateNuggetModal chunk', name: modalFile, bytes: modalBytes, max: createNuggetModalChunkMaxBytes },
];

let failed = false;
for (const r of rows) {
  const ok = r.bytes <= r.max;
  if (!ok) failed = true;
  console.log(
    `${ok ? '✅' : '❌'} ${r.label} ${r.name}: ${r.bytes} bytes (max ${r.max})`,
  );
}

if (failed) {
  console.error('\nBundle size budget exceeded. Update code-splitting or raise limits in scripts/bundle-budget.json with intent.');
  process.exit(1);
}
process.exit(0);
