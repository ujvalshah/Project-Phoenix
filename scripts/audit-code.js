#!/usr/bin/env node

/**
 * Proactive Code Audit Script
 * 
 * Scans codebase for common bug patterns and anti-patterns
 * Run with: node scripts/audit-code.js
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const ISSUES = {
  critical: [],
  warnings: [],
  suggestions: []
};

const PATTERNS = {
  // Critical patterns
  stateUpdateAfterUnmount: {
    pattern: /set[A-Z]\w+\s*\([^)]*\)\s*;?\s*(?!.*if\s*\(.*isMounted|mounted)/g,
    message: 'State update without mount check',
    severity: 'critical',
    context: 'Look for setState calls in async functions without isMounted checks'
  },
  arrayMethodWithoutCheck: {
    pattern: /\.(filter|map|forEach|reduce)\(/g,
    beforePattern: /(?:const|let|var)\s+\w+\s*=\s*(?!Array\.isArray\(|\[|.*\?.*:.*\[\])/,
    message: 'Array method called without validation',
    severity: 'critical',
    context: 'Arrays should be validated before calling methods'
  },
  asyncWithoutTryCatch: {
    pattern: /await\s+\w+\([^)]*\)\s*;?\s*(?!.*catch)/g,
    message: 'Async operation without try-catch',
    severity: 'critical',
    context: 'All async operations should have error handling'
  },
  useEffectWithoutCleanup: {
    pattern: /useEffect\s*\([^)]*=>\s*\{[^}]*await[^}]*\}\s*,\s*\[/g,
    message: 'useEffect with async but no cleanup',
    severity: 'critical',
    context: 'useEffect with async operations should have cleanup'
  },
  
  // Warnings
  anyType: {
    pattern: /:\s*any\b/g,
    message: 'Usage of any type',
    severity: 'warning',
    context: 'Consider using proper types instead of any'
  },
  consoleLog: {
    pattern: /console\.(log|debug)\(/g,
    message: 'Console.log found',
    severity: 'warning',
    context: 'Remove console.logs before production'
  },
  navigateWithoutGuard: {
    pattern: /navigate\([^)]*\)\s*;?\s*(?!.*if\s*\(.*isProcessing|processing)/g,
    message: 'Navigation without guard',
    severity: 'warning',
    context: 'Consider guarding navigation during operations'
  }
};

function scanFile(filePath) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    
    // Skip test files and node_modules
    if (filePath.includes('node_modules') || filePath.includes('.test.') || filePath.includes('.spec.')) {
      return;
    }
    
    lines.forEach((line, index) => {
      // Check each pattern
      Object.entries(PATTERNS).forEach(([name, rule]) => {
        const match = rule.pattern.exec(line);
        if (match) {
          // Reset regex
          rule.pattern.lastIndex = 0;
          
          const issue = {
            file: filePath,
            line: index + 1,
            pattern: name,
            message: rule.message,
            severity: rule.severity,
            context: rule.context,
            code: line.trim()
          };
          
          if (rule.severity === 'critical') {
            ISSUES.critical.push(issue);
          } else {
            ISSUES.warnings.push(issue);
          }
        }
      });
    });
  } catch (error) {
    console.error(`Error reading ${filePath}:`, error.message);
  }
}

function scanDirectory(dir, extensions = ['.ts', '.tsx', '.js', '.jsx']) {
  try {
    const entries = readdirSync(dir);
    
    entries.forEach(entry => {
      const fullPath = join(dir, entry);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory()) {
        // Skip certain directories
        if (!['node_modules', '.git', 'dist', 'build'].includes(entry)) {
          scanDirectory(fullPath, extensions);
        }
      } else if (stat.isFile()) {
        const ext = extname(entry);
        if (extensions.includes(ext)) {
          scanFile(fullPath);
        }
      }
    });
  } catch (error) {
    console.error(`Error scanning ${dir}:`, error.message);
  }
}

function printReport() {
  console.log('\n🔍 CODE AUDIT REPORT\n');
  console.log('='.repeat(60));
  
  // Critical issues
  if (ISSUES.critical.length > 0) {
    console.log(`\n🔴 CRITICAL ISSUES (${ISSUES.critical.length}):\n`);
    ISSUES.critical.forEach((issue, index) => {
      console.log(`${index + 1}. ${issue.message}`);
      console.log(`   File: ${issue.file}:${issue.line}`);
      console.log(`   Code: ${issue.code}`);
      console.log(`   Context: ${issue.context}\n`);
    });
  } else {
    console.log('\n✅ No critical issues found!\n');
  }
  
  // Warnings
  if (ISSUES.warnings.length > 0) {
    console.log(`\n🟡 WARNINGS (${ISSUES.warnings.length}):\n`);
    ISSUES.warnings.slice(0, 10).forEach((issue, index) => {
      console.log(`${index + 1}. ${issue.message}`);
      console.log(`   File: ${issue.file}:${issue.line}\n`);
    });
    
    if (ISSUES.warnings.length > 10) {
      console.log(`   ... and ${ISSUES.warnings.length - 10} more warnings\n`);
    }
  } else {
    console.log('\n✅ No warnings found!\n');
  }
  
  // Summary
  console.log('='.repeat(60));
  console.log('\n📊 SUMMARY:');
  console.log(`   Critical: ${ISSUES.critical.length}`);
  console.log(`   Warnings: ${ISSUES.warnings.length}`);
  console.log(`   Total: ${ISSUES.critical.length + ISSUES.warnings.length}\n`);
  
  if (ISSUES.critical.length > 0) {
    console.log('❌ Audit failed - Please fix critical issues before committing\n');
    process.exit(1);
  } else {
    console.log('✅ Audit passed!\n');
    process.exit(0);
  }
}

// Main execution
const srcDir = join(process.cwd(), 'src');
console.log('Scanning codebase...\n');
scanDirectory(srcDir);
printReport();












