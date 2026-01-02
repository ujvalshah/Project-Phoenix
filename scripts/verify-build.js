#!/usr/bin/env node

/**
 * Build Verification Script
 * 
 * Verifies that the production build completed successfully
 * and all required files exist.
 * 
 * Usage: node scripts/verify-build.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

console.log('\n🔍 Verifying production build...\n');

const checks = [];
let hasErrors = false;

// Check 1: dist directory exists
const distDir = path.join(rootDir, 'dist');
if (fs.existsSync(distDir)) {
  checks.push({ name: 'dist/ directory exists', status: '✅' });
} else {
  checks.push({ name: 'dist/ directory exists', status: '❌', error: 'Run "npm run build" first' });
  hasErrors = true;
}

// Check 2: index.html exists
const indexHtml = path.join(distDir, 'index.html');
if (fs.existsSync(indexHtml)) {
  checks.push({ name: 'dist/index.html exists', status: '✅' });
} else {
  checks.push({ name: 'dist/index.html exists', status: '❌', error: 'Build may have failed' });
  hasErrors = true;
}

// Check 3: assets directory exists
const assetsDir = path.join(distDir, 'assets');
if (fs.existsSync(assetsDir)) {
  const assets = fs.readdirSync(assetsDir);
  const jsFiles = assets.filter(f => f.endsWith('.js'));
  const cssFiles = assets.filter(f => f.endsWith('.css'));
  
  if (jsFiles.length > 0) {
    checks.push({ name: `JavaScript bundles (${jsFiles.length} files)`, status: '✅' });
  } else {
    checks.push({ name: 'JavaScript bundles', status: '❌', error: 'No JS files in assets' });
    hasErrors = true;
  }
  
  if (cssFiles.length > 0) {
    checks.push({ name: `CSS bundles (${cssFiles.length} files)`, status: '✅' });
  } else {
    checks.push({ name: 'CSS bundles', status: '⚠️', error: 'No CSS files (might be inlined)' });
  }
} else {
  checks.push({ name: 'dist/assets/ directory', status: '❌', error: 'Assets directory missing' });
  hasErrors = true;
}

// Check 4: Server compiled
const serverDist = path.join(rootDir, 'server', 'dist');
if (fs.existsSync(serverDist)) {
  const serverIndex = path.join(serverDist, 'index.js');
  if (fs.existsSync(serverIndex)) {
    checks.push({ name: 'Server compiled (server/dist/index.js)', status: '✅' });
  } else {
    checks.push({ name: 'Server compiled', status: '⚠️', error: 'server/dist/index.js missing - run TypeScript compilation' });
  }
} else {
  checks.push({ name: 'Server dist directory', status: '⚠️', error: 'Server not pre-compiled (will compile at runtime with tsx)' });
}

// Check 5: package.json has required scripts
const packageJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'package.json'), 'utf-8'));
const requiredScripts = ['build', 'dev:server'];
const missingScripts = requiredScripts.filter(s => !packageJson.scripts[s]);

if (missingScripts.length === 0) {
  checks.push({ name: 'Required npm scripts present', status: '✅' });
} else {
  checks.push({ name: 'Required npm scripts', status: '❌', error: `Missing: ${missingScripts.join(', ')}` });
  hasErrors = true;
}

// Check 6: env.example exists
const envExample = path.join(rootDir, 'env.example');
if (fs.existsSync(envExample)) {
  checks.push({ name: 'env.example exists', status: '✅' });
} else {
  checks.push({ name: 'env.example exists', status: '⚠️', error: 'Create env.example for deployment reference' });
}

// Print results
console.log('Build Verification Results:');
console.log('═'.repeat(50));

checks.forEach(check => {
  console.log(`${check.status} ${check.name}`);
  if (check.error) {
    console.log(`   └─ ${check.error}`);
  }
});

console.log('═'.repeat(50));

if (hasErrors) {
  console.log('\n❌ Build verification FAILED - fix errors above\n');
  process.exit(1);
} else {
  console.log('\n✅ Build verification PASSED - ready for deployment!\n');
  
  // Print deployment summary
  console.log('📦 Deployment Summary:');
  console.log('─'.repeat(50));
  
  // Calculate dist size
  if (fs.existsSync(distDir)) {
    const getDirectorySize = (dir) => {
      let size = 0;
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
          size += getDirectorySize(filePath);
        } else {
          size += stat.size;
        }
      }
      return size;
    };
    
    const distSize = getDirectorySize(distDir);
    const sizeMB = (distSize / 1024 / 1024).toFixed(2);
    console.log(`   Frontend bundle size: ${sizeMB} MB`);
  }
  
  console.log(`   Node.js version: ${process.version}`);
  console.log(`   Build type: Production`);
  console.log('─'.repeat(50));
  
  console.log('\n🚀 Next steps:');
  console.log('   1. Ensure .env is configured with production values');
  console.log('   2. Set NODE_ENV=production');
  console.log('   3. Deploy to your hosting platform');
  console.log('');
  
  process.exit(0);
}





