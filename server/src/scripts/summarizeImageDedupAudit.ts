/**
 * Image Deduplication Audit Summary Script
 * 
 * PHASE 1: Read-only analysis tool for image deduplication audit logs
 * 
 * This script:
 * - Reads and parses the Phase-1 audit log (logs/image-dedup-audit.md)
 * - Analyzes deduplication patterns and metrics
 * - Identifies risk signals and suspicious cases
 * - Generates structured JSON summary report
 * - Does NOT modify any runtime logic or database
 * - Supports Phase-2 refactor decisions only
 * 
 * Usage:
 *   tsx server/src/scripts/summarizeImageDedupAudit.ts
 * 
 * Output:
 *   - Console summary (human-readable)
 *   - reports/image-dedup-summary-{timestamp}.json
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';

// Types for parsed audit entries
interface ParsedAuditEntry {
  timestamp: string;
  mode: 'create' | 'edit';
  articleId?: string;
  totalInputImages: number;
  totalOutputImages: number;
  duplicatesDetected: number;
  imagesRemoved: number;
  movedToSupportingMedia: number;
  duplicateTypes: string[];
  editModeEvents?: string[];
  createModeEvents?: string[];
  normalizedPairs?: Array<{ original: string; normalized: string }>;
  rawText?: string; // Store raw entry for debugging
}

interface GlobalStats {
  totalEntries: number;
  createModeEntries: number;
  editModeEntries: number;
  totalDuplicateEvents: number;
  totalPrunedImages: number;
  totalMovedToSupportingMedia: number;
  totalInputImages: number;
  totalOutputImages: number;
  avgInputImages: number;
  avgOutputImages: number;
  avgDuplicatesPerEntry: number;
}

interface DuplicatePatternBreakdown {
  caseInsensitiveCount: number;
  queryParamVariants: number;
  whitespaceTrimCount: number;
  uploadedVsPastedDuplicates: number;
  duplicateTypeDistribution: Record<string, number>;
}

interface RiskSignal {
  type: string;
  severity: 'low' | 'medium' | 'high';
  count: number;
  description: string;
  sampleArticleIds: string[];
}

interface ModeBreakdown {
  create: {
    avgInputImages: number;
    avgOutputImages: number;
    avgDuplicates: number;
    mostFrequentDuplicatePattern: string;
    totalEntries: number;
  };
  edit: {
    avgInputImages: number;
    avgOutputImages: number;
    imagesPrunedDueToSupportingMedia: number;
    imagesLostVsMoved: number;
    pruningRiskCases: number;
    totalEntries: number;
  };
}

interface SuspiciousCase {
  entryIndex: number;
  timestamp: string;
  mode: 'create' | 'edit';
  articleId?: string;
  riskScore: number;
  riskFactors: string[];
  inputOutputDelta: number;
  duplicatesDetected: number;
  imagesRemoved: number;
  movedToSupportingMedia: number;
}

interface SummaryReport {
  metadata: {
    generatedAt: string;
    auditLogPath: string;
    totalEntriesParsed: number;
    entriesSkipped: number;
    executionTimeMs: number;
  };
  globalStats: GlobalStats;
  duplicatePatterns: DuplicatePatternBreakdown;
  modeBreakdown: ModeBreakdown;
  riskSignals: RiskSignal[];
  suspiciousCases: SuspiciousCase[];
}

/**
 * Parse a markdown audit log entry
 * Tolerates malformed entries and missing fields
 */
function parseAuditEntry(lines: string[], startIndex: number): { entry: ParsedAuditEntry | null; nextIndex: number } {
  let i = startIndex;
  const entry: Partial<ParsedAuditEntry> = {
    duplicateTypes: [],
    editModeEvents: [],
    createModeEvents: [],
    normalizedPairs: [],
  };

  // Skip until we find a header (## timestamp - MODE)
  while (i < lines.length && !lines[i].startsWith('## ')) {
    i++;
  }

  if (i >= lines.length) {
    return { entry: null, nextIndex: i };
  }

  // Parse header: ## timestamp - MODE Mode
  const headerMatch = lines[i].match(/^## (.+?) - (CREATE|EDIT) Mode$/i);
  if (!headerMatch) {
    return { entry: null, nextIndex: i + 1 };
  }

  entry.timestamp = headerMatch[1].trim();
  entry.mode = headerMatch[2].toLowerCase() as 'create' | 'edit';
  i++;

  // Parse fields until next header or end
  const rawText: string[] = [lines[i - 1]];

  while (i < lines.length && !lines[i].startsWith('## ')) {
    const line = lines[i].trim();
    rawText.push(line);

    // Parse key-value pairs
    if (line.startsWith('- **')) {
      const match = line.match(/- \*\*([^*]+)\*\*: (.+)$/);
      if (match) {
        const key = match[1].trim();
        const value = match[2].trim();

        switch (key) {
          case 'Article ID':
            entry.articleId = value === 'N/A (new article)' ? undefined : value;
            break;
          case 'Input Images':
            entry.totalInputImages = parseInt(value, 10) || 0;
            break;
          case 'Output Images':
            entry.totalOutputImages = parseInt(value, 10) || 0;
            break;
          case 'Duplicates Detected':
            entry.duplicatesDetected = parseInt(value, 10) || 0;
            break;
          case 'Images Removed':
            entry.imagesRemoved = parseInt(value, 10) || 0;
            break;
          case 'Moved to Supporting Media':
            entry.movedToSupportingMedia = parseInt(value, 10) || 0;
            break;
          case 'Duplicate Types':
            entry.duplicateTypes = value === 'none' ? [] : value.split(',').map(t => t.trim());
            break;
        }
      }
    }

    // Parse mode-specific events sections
    if (line.startsWith('### Edit Mode Events') || line.startsWith('### Create Mode Events')) {
      i++;
      const events: string[] = [];
      while (i < lines.length && !lines[i].startsWith('### ') && !lines[i].startsWith('## ') && lines[i].trim() !== '---') {
        const eventLine = lines[i].trim();
        if (eventLine.startsWith('- ')) {
          events.push(eventLine.substring(2).trim());
        }
        i++;
      }
      if (line.includes('Edit Mode')) {
        entry.editModeEvents = events;
      } else {
        entry.createModeEvents = events;
      }
      continue;
    }

    // Parse normalized pairs section
    if (line.startsWith('### Normalized Pairs')) {
      i++;
      const pairs: Array<{ original: string; normalized: string }> = [];
      while (i < lines.length && !lines[i].startsWith('### ') && !lines[i].startsWith('## ') && lines[i].trim() !== '---') {
        const pairLine = lines[i].trim();
        const match = pairLine.match(/^- `(.+?)` → `(.+?)`$/);
        if (match) {
          pairs.push({
            original: match[1],
            normalized: match[2],
          });
        }
        i++;
      }
      entry.normalizedPairs = pairs;
      continue;
    }

    i++;
  }

  // Skip separator line
  if (i < lines.length && lines[i].trim() === '---') {
    i++;
  }

  entry.rawText = rawText.join('\n');

  // Validate we have minimum required fields
  if (entry.timestamp && entry.mode && typeof entry.totalInputImages === 'number') {
    return {
      entry: entry as ParsedAuditEntry,
      nextIndex: i,
    };
  }

  return { entry: null, nextIndex: i };
}

/**
 * Parse entire audit log file
 */
function parseAuditLog(filePath: string): ParsedAuditEntry[] {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const entries: ParsedAuditEntry[] = [];
  let i = 0;

  while (i < lines.length) {
    const { entry, nextIndex } = parseAuditEntry(lines, i);
    if (entry) {
      entries.push(entry);
    }
    i = nextIndex;
  }

  return entries;
}

/**
 * Calculate global statistics
 */
function calculateGlobalStats(entries: ParsedAuditEntry[]): GlobalStats {
  const createEntries = entries.filter(e => e.mode === 'create');
  const editEntries = entries.filter(e => e.mode === 'edit');

  const totalInputImages = entries.reduce((sum, e) => sum + e.totalInputImages, 0);
  const totalOutputImages = entries.reduce((sum, e) => sum + e.totalOutputImages, 0);
  const totalDuplicates = entries.reduce((sum, e) => sum + e.duplicatesDetected, 0);
  const totalPruned = entries.reduce((sum, e) => sum + e.imagesRemoved, 0);
  const totalMoved = entries.reduce((sum, e) => sum + e.movedToSupportingMedia, 0);

  return {
    totalEntries: entries.length,
    createModeEntries: createEntries.length,
    editModeEntries: editEntries.length,
    totalDuplicateEvents: totalDuplicates,
    totalPrunedImages: totalPruned,
    totalMovedToSupportingMedia: totalMoved,
    totalInputImages,
    totalOutputImages,
    avgInputImages: entries.length > 0 ? totalInputImages / entries.length : 0,
    avgOutputImages: entries.length > 0 ? totalOutputImages / entries.length : 0,
    avgDuplicatesPerEntry: entries.length > 0 ? totalDuplicates / entries.length : 0,
  };
}

/**
 * Analyze duplicate patterns
 */
function analyzeDuplicatePatterns(entries: ParsedAuditEntry[]): DuplicatePatternBreakdown {
  let caseInsensitiveCount = 0;
  let queryParamVariants = 0;
  let whitespaceTrimCount = 0;
  let uploadedVsPastedDuplicates = 0;
  const duplicateTypeDistribution: Record<string, number> = {};

  for (const entry of entries) {
    // Count by duplicate type
    for (const type of entry.duplicateTypes) {
      duplicateTypeDistribution[type] = (duplicateTypeDistribution[type] || 0) + 1;
    }

    // Analyze create mode events for uploaded vs pasted
    if (entry.mode === 'create' && entry.createModeEvents) {
      for (const event of entry.createModeEvents) {
        if (event.includes('pasted URL') && event.includes('duplicate uploaded')) {
          const match = event.match(/(\d+)/);
          if (match) {
            uploadedVsPastedDuplicates += parseInt(match[1], 10);
          }
        }
      }
    }
  }

  caseInsensitiveCount = duplicateTypeDistribution['case-insensitive'] || 0;
  queryParamVariants = duplicateTypeDistribution['query-params'] || 0;
  whitespaceTrimCount = duplicateTypeDistribution['whitespace-trim'] || 0;

  return {
    caseInsensitiveCount,
    queryParamVariants,
    whitespaceTrimCount,
    uploadedVsPastedDuplicates,
    duplicateTypeDistribution,
  };
}

/**
 * Detect risk signals
 */
function detectRiskSignals(entries: ParsedAuditEntry[]): RiskSignal[] {
  const signals: RiskSignal[] = [];

  // Risk: Images removed without replacement
  const removedWithoutReplacement = entries.filter(
    e => e.imagesRemoved > 0 && e.movedToSupportingMedia === 0
  );
  if (removedWithoutReplacement.length > 0) {
    signals.push({
      type: 'images_removed_without_replacement',
      severity: 'high',
      count: removedWithoutReplacement.length,
      description: 'Images were removed but not moved to supportingMedia',
      sampleArticleIds: removedWithoutReplacement
        .slice(0, 10)
        .map(e => e.articleId || 'N/A')
        .filter(id => id !== 'N/A'),
    });
  }

  // Risk: EDIT mode image loss
  const editModeLoss = entries.filter(
    e => e.mode === 'edit' && e.totalOutputImages < e.totalInputImages && e.movedToSupportingMedia === 0
  );
  if (editModeLoss.length > 0) {
    signals.push({
      type: 'edit_mode_image_loss',
      severity: 'high',
      count: editModeLoss.length,
      description: 'EDIT mode entries where output images < input images without supportingMedia move',
      sampleArticleIds: editModeLoss
        .slice(0, 10)
        .map(e => e.articleId || 'N/A')
        .filter(id => id !== 'N/A'),
    });
  }

  // Risk: Mismatched input vs output counts
  const mismatchedCounts = entries.filter(
    e => e.totalInputImages !== e.totalOutputImages && e.duplicatesDetected === 0 && e.imagesRemoved === 0
  );
  if (mismatchedCounts.length > 0) {
    signals.push({
      type: 'unexplained_count_mismatch',
      severity: 'medium',
      count: mismatchedCounts.length,
      description: 'Input/output count mismatch without detected duplicates or removals',
      sampleArticleIds: mismatchedCounts
        .slice(0, 10)
        .map(e => e.articleId || 'N/A')
        .filter(id => id !== 'N/A'),
    });
  }

  // Risk: High duplicate concentration
  const highDuplicateConcentration = entries.filter(
    e => e.duplicatesDetected > 0 && e.duplicatesDetected >= e.totalInputImages * 0.5
  );
  if (highDuplicateConcentration.length > 0) {
    signals.push({
      type: 'high_duplicate_concentration',
      severity: 'medium',
      count: highDuplicateConcentration.length,
      description: 'Entries where duplicates represent 50%+ of input images',
      sampleArticleIds: highDuplicateConcentration
        .slice(0, 10)
        .map(e => e.articleId || 'N/A')
        .filter(id => id !== 'N/A'),
    });
  }

  return signals;
}

/**
 * Calculate mode-level breakdowns
 */
function calculateModeBreakdown(entries: ParsedAuditEntry[]): ModeBreakdown {
  const createEntries = entries.filter(e => e.mode === 'create');
  const editEntries = entries.filter(e => e.mode === 'edit');

  // CREATE mode analysis
  const createInputSum = createEntries.reduce((sum, e) => sum + e.totalInputImages, 0);
  const createOutputSum = createEntries.reduce((sum, e) => sum + e.totalOutputImages, 0);
  const createDuplicatesSum = createEntries.reduce((sum, e) => sum + e.duplicatesDetected, 0);

  // Find most frequent duplicate pattern in CREATE mode
  const createDuplicateTypes: Record<string, number> = {};
  for (const entry of createEntries) {
    for (const type of entry.duplicateTypes) {
      createDuplicateTypes[type] = (createDuplicateTypes[type] || 0) + 1;
    }
  }
  const mostFrequentPattern = Object.entries(createDuplicateTypes)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || 'none';

  // EDIT mode analysis
  const editInputSum = editEntries.reduce((sum, e) => sum + e.totalInputImages, 0);
  const editOutputSum = editEntries.reduce((sum, e) => sum + e.totalOutputImages, 0);
  const editPrunedForSupporting = editEntries.reduce((sum, e) => sum + e.movedToSupportingMedia, 0);
  const editImagesLost = editEntries.reduce(
    (sum, e) => sum + Math.max(0, e.totalInputImages - e.totalOutputImages - e.movedToSupportingMedia),
    0
  );
  const editPruningRiskCases = editEntries.filter(
    e => e.imagesRemoved > 0 && e.movedToSupportingMedia === 0
  ).length;

  return {
    create: {
      avgInputImages: createEntries.length > 0 ? createInputSum / createEntries.length : 0,
      avgOutputImages: createEntries.length > 0 ? createOutputSum / createEntries.length : 0,
      avgDuplicates: createEntries.length > 0 ? createDuplicatesSum / createEntries.length : 0,
      mostFrequentDuplicatePattern: mostFrequentPattern,
      totalEntries: createEntries.length,
    },
    edit: {
      avgInputImages: editEntries.length > 0 ? editInputSum / editEntries.length : 0,
      avgOutputImages: editEntries.length > 0 ? editOutputSum / editEntries.length : 0,
      imagesPrunedDueToSupportingMedia: editPrunedForSupporting,
      imagesLostVsMoved: editImagesLost,
      pruningRiskCases: editPruningRiskCases,
      totalEntries: editEntries.length,
    },
  };
}

/**
 * Identify top suspicious cases
 */
function identifySuspiciousCases(entries: ParsedAuditEntry[]): SuspiciousCase[] {
  const suspicious: SuspiciousCase[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const riskFactors: string[] = [];
    let riskScore = 0;

    const delta = entry.totalInputImages - entry.totalOutputImages;

    // High delta risk
    if (delta > 3) {
      riskScore += 10;
      riskFactors.push(`High input/output delta: ${delta}`);
    }

    // Unexpected pruning
    if (entry.imagesRemoved > 0 && entry.movedToSupportingMedia === 0) {
      riskScore += 15;
      riskFactors.push('Images removed without moving to supportingMedia');
    }

    // Missing media after pruning
    if (entry.mode === 'edit' && entry.imagesRemoved > 0 && entry.totalOutputImages === 0) {
      riskScore += 20;
      riskFactors.push('All images removed in EDIT mode');
    }

    // High duplicate concentration
    if (entry.duplicatesDetected > 0 && entry.duplicatesDetected >= entry.totalInputImages * 0.5) {
      riskScore += 8;
      riskFactors.push(`High duplicate concentration: ${entry.duplicatesDetected}/${entry.totalInputImages}`);
    }

    // Unexplained mismatch
    if (delta > 0 && entry.duplicatesDetected === 0 && entry.imagesRemoved === 0) {
      riskScore += 12;
      riskFactors.push('Unexplained input/output mismatch');
    }

    if (riskScore > 0) {
      suspicious.push({
        entryIndex: i,
        timestamp: entry.timestamp,
        mode: entry.mode,
        articleId: entry.articleId,
        riskScore,
        riskFactors,
        inputOutputDelta: delta,
        duplicatesDetected: entry.duplicatesDetected,
        imagesRemoved: entry.imagesRemoved,
        movedToSupportingMedia: entry.movedToSupportingMedia,
      });
    }
  }

  // Sort by risk score (descending) and return top 10
  return suspicious.sort((a, b) => b.riskScore - a.riskScore).slice(0, 10);
}

/**
 * Generate console summary
 */
function printConsoleSummary(report: SummaryReport): void {
  console.log('\n' + '='.repeat(80));
  console.log('IMAGE DEDUPLICATION AUDIT SUMMARY');
  console.log('='.repeat(80));
  console.log(`Generated: ${report.metadata.generatedAt}`);
  console.log(`Audit Log: ${report.metadata.auditLogPath}`);
  console.log(`Entries Parsed: ${report.metadata.totalEntriesParsed}`);
  console.log(`Entries Skipped: ${report.metadata.entriesSkipped}`);
  console.log(`Execution Time: ${report.metadata.executionTimeMs}ms\n`);

  console.log('GLOBAL STATISTICS');
  console.log('-'.repeat(80));
  console.log(`Total Entries: ${report.globalStats.totalEntries}`);
  console.log(`  - CREATE mode: ${report.globalStats.createModeEntries}`);
  console.log(`  - EDIT mode: ${report.globalStats.editModeEntries}`);
  console.log(`Total Duplicate Events: ${report.globalStats.totalDuplicateEvents}`);
  console.log(`Total Pruned Images: ${report.globalStats.totalPrunedImages}`);
  console.log(`Total Moved to SupportingMedia: ${report.globalStats.totalMovedToSupportingMedia}`);
  console.log(`Average Input Images: ${report.globalStats.avgInputImages.toFixed(2)}`);
  console.log(`Average Output Images: ${report.globalStats.avgOutputImages.toFixed(2)}`);
  console.log(`Average Duplicates per Entry: ${report.globalStats.avgDuplicatesPerEntry.toFixed(2)}\n`);

  console.log('DUPLICATE PATTERNS');
  console.log('-'.repeat(80));
  console.log(`Case-Insensitive Duplicates: ${report.duplicatePatterns.caseInsensitiveCount}`);
  console.log(`Query Param Variants: ${report.duplicatePatterns.queryParamVariants}`);
  console.log(`Whitespace Trim Duplicates: ${report.duplicatePatterns.whitespaceTrimCount}`);
  console.log(`Uploaded vs Pasted URL Duplicates: ${report.duplicatePatterns.uploadedVsPastedDuplicates}\n`);

  console.log('MODE BREAKDOWN');
  console.log('-'.repeat(80));
  console.log('CREATE Mode:');
  console.log(`  - Avg Input Images: ${report.modeBreakdown.create.avgInputImages.toFixed(2)}`);
  console.log(`  - Avg Output Images: ${report.modeBreakdown.create.avgOutputImages.toFixed(2)}`);
  console.log(`  - Avg Duplicates: ${report.modeBreakdown.create.avgDuplicates.toFixed(2)}`);
  console.log(`  - Most Frequent Pattern: ${report.modeBreakdown.create.mostFrequentDuplicatePattern}`);
  console.log('EDIT Mode:');
  console.log(`  - Avg Input Images: ${report.modeBreakdown.edit.avgInputImages.toFixed(2)}`);
  console.log(`  - Avg Output Images: ${report.modeBreakdown.edit.avgOutputImages.toFixed(2)}`);
  console.log(`  - Images Pruned (SupportingMedia): ${report.modeBreakdown.edit.imagesPrunedDueToSupportingMedia}`);
  console.log(`  - Images Lost vs Moved: ${report.modeBreakdown.edit.imagesLostVsMoved}`);
  console.log(`  - Pruning Risk Cases: ${report.modeBreakdown.edit.pruningRiskCases}\n`);

  console.log('RISK SIGNALS');
  console.log('-'.repeat(80));
  if (report.riskSignals.length === 0) {
    console.log('No risk signals detected.');
  } else {
    for (const signal of report.riskSignals) {
      console.log(`[${signal.severity.toUpperCase()}] ${signal.type}: ${signal.count} cases`);
      console.log(`  ${signal.description}`);
      if (signal.sampleArticleIds.length > 0) {
        console.log(`  Sample IDs: ${signal.sampleArticleIds.slice(0, 5).join(', ')}${signal.sampleArticleIds.length > 5 ? '...' : ''}`);
      }
    }
  }
  console.log('');

  console.log('TOP SUSPICIOUS CASES');
  console.log('-'.repeat(80));
  if (report.suspiciousCases.length === 0) {
    console.log('No suspicious cases identified.');
  } else {
    for (const case_ of report.suspiciousCases) {
      console.log(`[Risk Score: ${case_.riskScore}] ${case_.mode.toUpperCase()} - ${case_.timestamp}`);
      console.log(`  Article ID: ${case_.articleId || 'N/A'}`);
      console.log(`  Input/Output Delta: ${case_.inputOutputDelta}`);
      console.log(`  Risk Factors: ${case_.riskFactors.join('; ')}`);
    }
  }
  console.log('\n' + '='.repeat(80));
}

/**
 * Main execution
 */
function main(): void {
  const startTime = Date.now();
  const projectRoot = join(__dirname, '../../..');
  const auditLogPath = join(projectRoot, 'logs', 'image-dedup-audit.md');
  const reportsDir = join(projectRoot, 'reports');

  // Ensure reports directory exists
  if (!existsSync(reportsDir)) {
    mkdirSync(reportsDir, { recursive: true });
  }

  // Check if audit log exists
  if (!existsSync(auditLogPath)) {
    console.error(`Error: Audit log not found at ${auditLogPath}`);
    console.error('Please ensure Phase-1 audit logging has generated entries.');
    process.exit(1);
  }

  console.log('Parsing audit log...');
  const entries = parseAuditLog(auditLogPath);
  const skipped = 0; // Could track parse failures if needed

  if (entries.length === 0) {
    console.warn('Warning: No audit entries found in log file.');
    console.warn('The audit log may be empty or in an unexpected format.');
  }

  console.log(`Parsed ${entries.length} audit entries.`);

  // Calculate metrics
  console.log('Calculating metrics...');
  const globalStats = calculateGlobalStats(entries);
  const duplicatePatterns = analyzeDuplicatePatterns(entries);
  const modeBreakdown = calculateModeBreakdown(entries);
  const riskSignals = detectRiskSignals(entries);
  const suspiciousCases = identifySuspiciousCases(entries);

  // Generate report
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const report: SummaryReport = {
    metadata: {
      generatedAt: new Date().toISOString(),
      auditLogPath,
      totalEntriesParsed: entries.length,
      entriesSkipped: skipped,
      executionTimeMs: Date.now() - startTime,
    },
    globalStats,
    duplicatePatterns,
    modeBreakdown,
    riskSignals,
    suspiciousCases,
  };

  // Write JSON report
  const reportPath = join(reportsDir, `image-dedup-summary-${timestamp}.json`);
  writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`\nJSON report written to: ${reportPath}`);

  // Print console summary
  printConsoleSummary(report);

  console.log(`\nSummary complete. Report saved to: ${reportPath}`);
}

// Run if executed directly
if (require.main === module) {
  main();
}

export { main };

