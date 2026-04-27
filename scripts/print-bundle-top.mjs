#!/usr/bin/env node
/**
 * After `npm run analyze:bundle`, prints largest nodes in dist/stats.html (treemap data).
 * Not run in CI.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const statsPath = path.join(__dirname, '..', 'dist', 'stats.html');
if (!fs.existsSync(statsPath)) {
  console.error('Run npm run analyze:bundle first (dist/stats.html missing).');
  process.exit(1);
}
const html = fs.readFileSync(statsPath, 'utf8');
const start = html.indexOf('const data = ');
if (start === -1) {
  console.error('Could not find bundle data in stats.html');
  process.exit(1);
}
const jsonStart = start + 'const data = '.length;
let depth = 0;
let i = jsonStart;
for (; i < html.length; i++) {
  const c = html[i];
  if (c === '{') depth++;
  else if (c === '}') {
    depth--;
    if (depth === 0) {
      i++;
      break;
    }
  }
}
const data = JSON.parse(html.slice(jsonStart, i));
const parts = data.nodeParts || {};

/** @type {{ label: string; size: number }[]} */
const rows = [];
function walk(n, prefix = '') {
  const label = n.name ? `${prefix}/${n.name}`.replace(/^\//, '') : prefix;
  if (n.uid && parts[n.uid]) {
    const sz = parts[n.uid].renderedLength;
    if (typeof sz === 'number' && sz > 0) {
      rows.push({ label: label || n.name || n.uid, size: sz });
    }
  }
  for (const c of n.children || []) {
    walk(c, label);
  }
}
walk(data.tree);
rows.sort((a, b) => b.size - a.size);
console.log('Largest nodes (renderedLength, from stats.html — open in browser for full treemap):\n');
for (const row of rows.slice(0, 12)) {
  console.log(`${String(row.size).padStart(8)}  ${row.label}`);
}
