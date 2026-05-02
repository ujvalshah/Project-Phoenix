/**
 * Runs the compiled Express app from an absolute path and cwd anchored at the
 * directory that contains `server/dist/index.js` (repo root).
 *
 * Walks up from this file so it still works if the script lives under an extra
 * directory segment (e.g. some hosts mirror layout under `src/`).
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function findPackageRootWithServerDist(startDir) {
  let dir = path.resolve(startDir);
  const root = path.parse(dir).root;
  while (dir !== root) {
    const entry = path.join(dir, 'server', 'dist', 'index.js');
    if (existsSync(entry)) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      break;
    }
    dir = parent;
  }
  return null;
}

const startDir = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = findPackageRootWithServerDist(startDir);

if (!packageRoot) {
  console.error(
    `Could not find server/dist/index.js by walking up from ${startDir}.\nRun "npm run build" (or "npm run build:server") at the repository root, then redeploy.`,
  );
  process.exit(1);
}

const entry = path.join(packageRoot, 'server', 'dist', 'index.js');

const child = spawn(process.execPath, [entry], {
  cwd: packageRoot,
  stdio: 'inherit',
  env: process.env,
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 1);
});
