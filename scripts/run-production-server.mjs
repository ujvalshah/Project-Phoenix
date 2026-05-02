/**
 * Runs the compiled Express app from an absolute path and cwd anchored at the
 * package root. This avoids MODULE_NOT_FOUND when the process cwd is wrong
 * (e.g. Render "Root Directory" set to `src/` so `node server/dist/index.js`
 * resolves to `src/server/dist/...` instead of repo `server/dist/...`).
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, '..');
const entry = path.join(packageRoot, 'server', 'dist', 'index.js');

if (!existsSync(entry)) {
  console.error(
    `Production server bundle missing: ${entry}\nRun "npm run build" (or "npm run build:server") at the repository root, then redeploy.`,
  );
  process.exit(1);
}

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
