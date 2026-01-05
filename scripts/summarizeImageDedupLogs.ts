/**
 * Image Deduplication Audit Log Summary Script
 * 
 * Phase-1 Analysis Tool - Read-only analysis of image deduplication audit logs
 * 
 * Purpose:
 * - Parse logs/image-dedup-audit.md
 * - Group events by mode, duplicate type, removal patterns
 * - Generate structured JSON and Markdown reports
 * - Provide risk assessment and Phase-2 recommendations
 * 
 * Usage:
 *   tsx scripts/summarizeImageDedupLogs.ts
 *   or
 *   npx tsx scripts/summarizeImageDedupLogs.ts
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

// Types for parsed audit entries
interface AuditEntry {
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
}

interface GroupedStats {
  byMode: {
    create: {
      count: number;
      totalInputImages: number;
      totalOutputImages: number;
      totalDuplicates: number;
      totalRemoved: number;
      totalMovedToSupporting: number;
      avgInputImages: number;
      avgOutputImages: number;
      avgDuplicates: number;
    };
    edit: {
      count: number;
      totalInputImages: number;
      totalOutputImages: number;
      totalDuplicates: number;
      totalRemoved: number;
      totalMovedToSupporting: number;
      avgInputImages: number;
      avgOutputImages: number;
      avgDuplicates: number;
      casesWithRemovals: number;
      casesWithMovedImages: number;
    };
  };
  byDuplicateType: Record<string, {
    count: number;
    entries: number;
    avgPerEntry: number;
  }>;
  byRemovalPattern: {
    removedWithoutReplacement: number;
    removedWithReplacement: number;
    movedToSupportingMedia: number;
    preserved: number;
  };
  bySupportingMedia: {
    totalMoved: number;
    entriesWithMoves: number;
    avgMovedPerEntry: number;
  };
}

interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high';
  editModeImageLoss: {
    count: number;
    cases: Array<{
      articleId?: string;
      timestamp: string;
      inputImages: number;
      outputImages: number;
      removed: number;
      moved: number;
    }>;
  };
  behaviorChangeRisks: string[];
  recommendations: string[];
}

interface SummaryReport {
  metadata: {
    generatedAt: string;
    auditLogPath: string;
    totalEntries: number;
    dateRange: {
      earliest: string;
      latest: string;
    };
  };
  groupedStats: GroupedStats;
  riskAssessment: RiskAssessment;
  patterns: {
    mostCommonDuplicateType: string;
    mostCommonRemovalPattern: string;
    editModeRemovalRate: number;
    createModeDeduplicationRate: number;
  };
}

/**
 * Parse markdown audit log entry
 */
function parseEntry(lines: string[], startIndex: number): { entry: AuditEntry | null; nextIndex: number } {
  let i = startIndex;
  
  // Find header
  while (i < lines.length && !lines[i].startsWith('## ')) {
    i++;
  }
  
  if (i >= lines.length) {
    return { entry: null, nextIndex: i };
  }
  
  const headerMatch = lines[i].match(/^## (.+?) - (CREATE|EDIT) Mode$/i);
  if (!headerMatch) {
    return { entry: null, nextIndex: i + 1 };
  }
  
  const entry: Partial<AuditEntry> = {
    timestamp: headerMatch[1].trim(),
    mode: headerMatch[2].toLowerCase() as 'create' | 'edit',
    duplicateTypes: [],
    editModeEvents: [],
    createModeEvents: [],
  };
  
  i++;
  
  // Parse fields
  while (i < lines.length && !lines[i].startsWith('## ')) {
    const line = lines[i].trim();
    
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
    
    if (line.startsWith('### Edit Mode Events')) {
      i++;
      const events: string[] = [];
      while (i < lines.length && !lines[i].startsWith('### ') && !lines[i].startsWith('## ') && lines[i].trim() !== '---') {
        const eventLine = lines[i].trim();
        if (eventLine.startsWith('- ')) {
          events.push(eventLine.substring(2).trim());
        }
        i++;
      }
      entry.editModeEvents = events;
      continue;
    }
    
    if (line.startsWith('### Create Mode Events')) {
      i++;
      const events: string[] = [];
      while (i < lines.length && !lines[i].startsWith('### ') && !lines[i].startsWith('## ') && lines[i].trim() !== '---') {
        const eventLine = lines[i].trim();
        if (eventLine.startsWith('- ')) {
          events.push(eventLine.substring(2).trim());
        }
        i++;
      }
      entry.createModeEvents = events;
      continue;
    }
    
    i++;
  }
  
  // Skip separator
  if (i < lines.length && lines[i].trim() === '---') {
    i++;
  }
  
  if (entry.timestamp && entry.mode && typeof entry.totalInputImages === 'number') {
    return { entry: entry as AuditEntry, nextIndex: i };
  }
  
  return { entry: null, nextIndex: i };
}

/**
 * Parse entire audit log
 */
function parseAuditLog(filePath: string): AuditEntry[] {
  if (!existsSync(filePath)) {
    return [];
  }
  
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const entries: AuditEntry[] = [];
  let i = 0;
  
  while (i < lines.length) {
    const { entry, nextIndex } = parseEntry(lines, i);
    if (entry) {
      entries.push(entry);
    }
    i = nextIndex;
  }
  
  return entries;
}

/**
 * Calculate grouped statistics
 */
function calculateGroupedStats(entries: AuditEntry[]): GroupedStats {
  const createEntries = entries.filter(e => e.mode === 'create');
  const editEntries = entries.filter(e => e.mode === 'edit');
  
  // Mode-level stats
  const createStats = {
    count: createEntries.length,
    totalInputImages: createEntries.reduce((sum, e) => sum + e.totalInputImages, 0),
    totalOutputImages: createEntries.reduce((sum, e) => sum + e.totalOutputImages, 0),
    totalDuplicates: createEntries.reduce((sum, e) => sum + e.duplicatesDetected, 0),
    totalRemoved: createEntries.reduce((sum, e) => sum + e.imagesRemoved, 0),
    totalMovedToSupporting: createEntries.reduce((sum, e) => sum + e.movedToSupportingMedia, 0),
    avgInputImages: createEntries.length > 0 ? createEntries.reduce((sum, e) => sum + e.totalInputImages, 0) / createEntries.length : 0,
    avgOutputImages: createEntries.length > 0 ? createEntries.reduce((sum, e) => sum + e.totalOutputImages, 0) / createEntries.length : 0,
    avgDuplicates: createEntries.length > 0 ? createEntries.reduce((sum, e) => sum + e.duplicatesDetected, 0) / createEntries.length : 0,
  };
  
  const editStats = {
    count: editEntries.length,
    totalInputImages: editEntries.reduce((sum, e) => sum + e.totalInputImages, 0),
    totalOutputImages: editEntries.reduce((sum, e) => sum + e.totalOutputImages, 0),
    totalDuplicates: editEntries.reduce((sum, e) => sum + e.duplicatesDetected, 0),
    totalRemoved: editEntries.reduce((sum, e) => sum + e.imagesRemoved, 0),
    totalMovedToSupporting: editEntries.reduce((sum, e) => sum + e.movedToSupportingMedia, 0),
    avgInputImages: editEntries.length > 0 ? editEntries.reduce((sum, e) => sum + e.totalInputImages, 0) / editEntries.length : 0,
    avgOutputImages: editEntries.length > 0 ? editEntries.reduce((sum, e) => sum + e.totalOutputImages, 0) / editEntries.length : 0,
    avgDuplicates: editEntries.length > 0 ? editEntries.reduce((sum, e) => sum + e.duplicatesDetected, 0) / editEntries.length : 0,
    casesWithRemovals: editEntries.filter(e => e.imagesRemoved > 0).length,
    casesWithMovedImages: editEntries.filter(e => e.movedToSupportingMedia > 0).length,
  };
  
  // Duplicate type stats
  const duplicateTypeStats: Record<string, { count: number; entries: number }> = {};
  for (const entry of entries) {
    for (const type of entry.duplicateTypes) {
      if (!duplicateTypeStats[type]) {
        duplicateTypeStats[type] = { count: 0, entries: 0 };
      }
      duplicateTypeStats[type].count += entry.duplicatesDetected;
      duplicateTypeStats[type].entries += 1;
    }
  }
  
  const byDuplicateType: Record<string, { count: number; entries: number; avgPerEntry: number }> = {};
  for (const [type, stats] of Object.entries(duplicateTypeStats)) {
    byDuplicateType[type] = {
      count: stats.count,
      entries: stats.entries,
      avgPerEntry: stats.entries > 0 ? stats.count / stats.entries : 0,
    };
  }
  
  // Removal pattern stats
  const removedWithoutReplacement = entries.filter(e => e.imagesRemoved > 0 && e.movedToSupportingMedia === 0).length;
  const removedWithReplacement = entries.filter(e => e.imagesRemoved > 0 && e.movedToSupportingMedia > 0).length;
  const movedToSupportingMedia = entries.filter(e => e.movedToSupportingMedia > 0).length;
  const preserved = entries.filter(e => e.imagesRemoved === 0 && e.movedToSupportingMedia === 0).length;
  
  // Supporting media stats
  const totalMoved = entries.reduce((sum, e) => sum + e.movedToSupportingMedia, 0);
  const entriesWithMoves = entries.filter(e => e.movedToSupportingMedia > 0).length;
  
  return {
    byMode: {
      create: createStats,
      edit: editStats,
    },
    byDuplicateType,
    byRemovalPattern: {
      removedWithoutReplacement,
      removedWithReplacement,
      movedToSupportingMedia,
      preserved,
    },
    bySupportingMedia: {
      totalMoved,
      entriesWithMoves,
      avgMovedPerEntry: entriesWithMoves > 0 ? totalMoved / entriesWithMoves : 0,
    },
  };
}

/**
 * Assess risks and provide recommendations
 */
function assessRisks(entries: AuditEntry[]): RiskAssessment {
  const editEntries = entries.filter(e => e.mode === 'edit');
  
  // Find EDIT mode image loss cases
  const imageLossCases = editEntries
    .filter(e => e.totalOutputImages < e.totalInputImages && e.movedToSupportingMedia === 0)
    .map(e => ({
      articleId: e.articleId,
      timestamp: e.timestamp,
      inputImages: e.totalInputImages,
      outputImages: e.totalOutputImages,
      removed: e.imagesRemoved,
      moved: e.movedToSupportingMedia,
    }));
  
  // Identify behavior change risks
  const risks: string[] = [];
  
  const removedWithoutReplacement = entries.filter(e => e.imagesRemoved > 0 && e.movedToSupportingMedia === 0);
  if (removedWithoutReplacement.length > 0) {
    risks.push(`${removedWithoutReplacement.length} entries had images removed without moving to supportingMedia`);
  }
  
  if (imageLossCases.length > 0) {
    risks.push(`${imageLossCases.length} EDIT mode entries lost images without replacement`);
  }
  
  const highDuplicateRate = entries.filter(e => e.duplicatesDetected > 0 && e.duplicatesDetected >= e.totalInputImages * 0.5);
  if (highDuplicateRate.length > 0) {
    risks.push(`${highDuplicateRate.length} entries have high duplicate concentration (50%+ of input)`);
  }
  
  // Determine overall risk
  let overallRisk: 'low' | 'medium' | 'high' = 'low';
  if (imageLossCases.length > 0 || removedWithoutReplacement.length > editEntries.length * 0.1) {
    overallRisk = 'high';
  } else if (removedWithoutReplacement.length > 0 || highDuplicateRate.length > 0) {
    overallRisk = 'medium';
  }
  
  // Generate recommendations
  const recommendations: string[] = [];
  
  if (entries.length === 0) {
    recommendations.push('No audit data available. Continue Phase-1 observation to collect baseline metrics.');
    recommendations.push('Ensure audit logging is active in normalizeArticleInput.ts');
  } else if (overallRisk === 'high') {
    recommendations.push('⚠️ HIGH RISK: Do NOT proceed to Phase-2 until image loss issues are resolved');
    recommendations.push('Investigate EDIT mode image removal cases before making behavior changes');
    recommendations.push('Consider adding safeguards to prevent unintended image removal');
  } else if (overallRisk === 'medium') {
    recommendations.push('⚠️ MEDIUM RISK: Proceed with caution to Phase-2');
    recommendations.push('Review removal patterns and ensure supportingMedia migration is working correctly');
    recommendations.push('Add additional validation before implementing behavior changes');
  } else {
    recommendations.push('✅ LOW RISK: Safe to proceed to Phase-2 behavior changes');
    recommendations.push('Current patterns show safe deduplication and pruning behavior');
    recommendations.push('Continue monitoring during Phase-2 implementation');
  }
  
  if (imageLossCases.length > 0) {
    recommendations.push(`Focus on ${imageLossCases.length} EDIT mode cases where images were lost`);
  }
  
  return {
    overallRisk,
    editModeImageLoss: {
      count: imageLossCases.length,
      cases: imageLossCases,
    },
    behaviorChangeRisks: risks,
    recommendations,
  };
}

/**
 * Generate markdown report
 */
function generateMarkdownReport(report: SummaryReport): string {
  const { metadata, groupedStats, riskAssessment, patterns } = report;
  
  let md = `# Image Deduplication Audit Summary\n\n`;
  md += `**Generated:** ${metadata.generatedAt}\n`;
  md += `**Audit Log:** ${metadata.auditLogPath}\n`;
  md += `**Total Entries:** ${metadata.totalEntries}\n`;
  md += `**Date Range:** ${metadata.dateRange.earliest} to ${metadata.dateRange.latest}\n\n`;
  
  md += `---\n\n`;
  md += `## Global Statistics\n\n`;
  md += `### By Mode\n\n`;
  md += `#### CREATE Mode\n`;
  md += `- **Entries:** ${groupedStats.byMode.create.count}\n`;
  md += `- **Total Input Images:** ${groupedStats.byMode.create.totalInputImages}\n`;
  md += `- **Total Output Images:** ${groupedStats.byMode.create.totalOutputImages}\n`;
  md += `- **Total Duplicates:** ${groupedStats.byMode.create.totalDuplicates}\n`;
  md += `- **Average Input Images:** ${groupedStats.byMode.create.avgInputImages.toFixed(2)}\n`;
  md += `- **Average Output Images:** ${groupedStats.byMode.create.avgOutputImages.toFixed(2)}\n`;
  md += `- **Average Duplicates:** ${groupedStats.byMode.create.avgDuplicates.toFixed(2)}\n\n`;
  
  md += `#### EDIT Mode\n`;
  md += `- **Entries:** ${groupedStats.byMode.edit.count}\n`;
  md += `- **Total Input Images:** ${groupedStats.byMode.edit.totalInputImages}\n`;
  md += `- **Total Output Images:** ${groupedStats.byMode.edit.totalOutputImages}\n`;
  md += `- **Total Duplicates:** ${groupedStats.byMode.edit.totalDuplicates}\n`;
  md += `- **Total Removed:** ${groupedStats.byMode.edit.totalRemoved}\n`;
  md += `- **Total Moved to SupportingMedia:** ${groupedStats.byMode.edit.totalMovedToSupporting}\n`;
  md += `- **Cases with Removals:** ${groupedStats.byMode.edit.casesWithRemovals}\n`;
  md += `- **Cases with Moved Images:** ${groupedStats.byMode.edit.casesWithMovedImages}\n`;
  md += `- **Average Input Images:** ${groupedStats.byMode.edit.avgInputImages.toFixed(2)}\n`;
  md += `- **Average Output Images:** ${groupedStats.byMode.edit.avgOutputImages.toFixed(2)}\n\n`;
  
  md += `### By Duplicate Type\n\n`;
  if (Object.keys(groupedStats.byDuplicateType).length === 0) {
    md += `No duplicate types detected.\n\n`;
  } else {
    for (const [type, stats] of Object.entries(groupedStats.byDuplicateType)) {
      md += `- **${type}**: ${stats.count} duplicates across ${stats.entries} entries (avg: ${stats.avgPerEntry.toFixed(2)} per entry)\n`;
    }
    md += `\n`;
  }
  
  md += `### By Removal Pattern\n\n`;
  md += `- **Removed Without Replacement:** ${groupedStats.byRemovalPattern.removedWithoutReplacement}\n`;
  md += `- **Removed With Replacement:** ${groupedStats.byRemovalPattern.removedWithReplacement}\n`;
  md += `- **Moved to SupportingMedia:** ${groupedStats.byRemovalPattern.movedToSupportingMedia}\n`;
  md += `- **Preserved:** ${groupedStats.byRemovalPattern.preserved}\n\n`;
  
  md += `### SupportingMedia Statistics\n\n`;
  md += `- **Total Images Moved:** ${groupedStats.bySupportingMedia.totalMoved}\n`;
  md += `- **Entries with Moves:** ${groupedStats.bySupportingMedia.entriesWithMoves}\n`;
  md += `- **Average Moved per Entry:** ${groupedStats.bySupportingMedia.avgMovedPerEntry.toFixed(2)}\n\n`;
  
  md += `---\n\n`;
  md += `## Risk Assessment\n\n`;
  md += `### Overall Risk Level: **${riskAssessment.overallRisk.toUpperCase()}**\n\n`;
  
  md += `### EDIT Mode Image Loss Cases\n\n`;
  if (riskAssessment.editModeImageLoss.count === 0) {
    md += `✅ No image loss cases detected in EDIT mode.\n\n`;
  } else {
    md += `⚠️ **${riskAssessment.editModeImageLoss.count} cases** where images were removed without replacement:\n\n`;
    for (const case_ of riskAssessment.editModeImageLoss.cases.slice(0, 10)) {
      md += `- **${case_.timestamp}** - Article ID: ${case_.articleId || 'N/A'}\n`;
      md += `  - Input: ${case_.inputImages} → Output: ${case_.outputImages} (Removed: ${case_.removed}, Moved: ${case_.moved})\n`;
    }
    if (riskAssessment.editModeImageLoss.cases.length > 10) {
      md += `\n... and ${riskAssessment.editModeImageLoss.cases.length - 10} more cases\n`;
    }
    md += `\n`;
  }
  
  md += `### Behavior Change Risks\n\n`;
  if (riskAssessment.behaviorChangeRisks.length === 0) {
    md += `✅ No significant behavior change risks identified.\n\n`;
  } else {
    for (const risk of riskAssessment.behaviorChangeRisks) {
      md += `- ⚠️ ${risk}\n`;
    }
    md += `\n`;
  }
  
  md += `### Recommendations\n\n`;
  for (const rec of riskAssessment.recommendations) {
    md += `- ${rec}\n`;
  }
  md += `\n`;
  
  md += `---\n\n`;
  md += `## Patterns\n\n`;
  md += `- **Most Common Duplicate Type:** ${patterns.mostCommonDuplicateType || 'N/A'}\n`;
  md += `- **Most Common Removal Pattern:** ${patterns.mostCommonRemovalPattern}\n`;
  md += `- **EDIT Mode Removal Rate:** ${(patterns.editModeRemovalRate * 100).toFixed(2)}%\n`;
  md += `- **CREATE Mode Deduplication Rate:** ${(patterns.createModeDeduplicationRate * 100).toFixed(2)}%\n\n`;
  
  return md;
}

/**
 * Main execution
 */
function main(): void {
  // Get project root - resolve from script location
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);
  const projectRoot = join(__dirname, '..');
  
  const auditLogPath = join(projectRoot, 'logs', 'image-dedup-audit.md');
  const reportsDir = join(projectRoot, 'reports');
  
  // Ensure reports directory exists
  if (!existsSync(reportsDir)) {
    mkdirSync(reportsDir, { recursive: true });
  }
  
  console.log('📊 Image Deduplication Audit Summary\n');
  console.log(`Reading audit log: ${auditLogPath}\n`);
  
  // Parse audit log
  const entries = parseAuditLog(auditLogPath);
  
  if (entries.length === 0) {
    console.log('⚠️  No audit entries found in log file.');
    console.log('The audit log may be empty or no deduplication events have occurred yet.\n');
  } else {
    console.log(`✅ Parsed ${entries.length} audit entries.\n`);
  }
  
  // Calculate statistics
  console.log('Calculating statistics...');
  const groupedStats = calculateGroupedStats(entries);
  
  // Assess risks
  console.log('Assessing risks...');
  const riskAssessment = assessRisks(entries);
  
  // Find patterns
  const duplicateTypes = Object.keys(groupedStats.byDuplicateType);
  const mostCommonDuplicateType = duplicateTypes.length > 0
    ? duplicateTypes.reduce((a, b) => 
        groupedStats.byDuplicateType[a].count > groupedStats.byDuplicateType[b].count ? a : b
      )
    : 'none';
  
  const removalPatterns = [
    { name: 'removedWithoutReplacement', count: groupedStats.byRemovalPattern.removedWithoutReplacement },
    { name: 'removedWithReplacement', count: groupedStats.byRemovalPattern.removedWithReplacement },
    { name: 'movedToSupportingMedia', count: groupedStats.byRemovalPattern.movedToSupportingMedia },
    { name: 'preserved', count: groupedStats.byRemovalPattern.preserved },
  ];
  const mostCommonRemovalPattern = removalPatterns.reduce((a, b) => a.count > b.count ? a : b).name;
  
  const editModeRemovalRate = groupedStats.byMode.edit.count > 0
    ? groupedStats.byMode.edit.casesWithRemovals / groupedStats.byMode.edit.count
    : 0;
  
  const createModeDeduplicationRate = groupedStats.byMode.create.count > 0
    ? groupedStats.byMode.create.totalDuplicates / groupedStats.byMode.create.totalInputImages
    : 0;
  
  // Get date range
  const timestamps = entries.map(e => e.timestamp).filter(Boolean);
  const dateRange = {
    earliest: timestamps.length > 0 ? timestamps.sort()[0] : 'N/A',
    latest: timestamps.length > 0 ? timestamps.sort()[timestamps.length - 1] : 'N/A',
  };
  
  // Generate report
  const report: SummaryReport = {
    metadata: {
      generatedAt: new Date().toISOString(),
      auditLogPath,
      totalEntries: entries.length,
      dateRange,
    },
    groupedStats,
    riskAssessment,
    patterns: {
      mostCommonDuplicateType,
      mostCommonRemovalPattern,
      editModeRemovalRate,
      createModeDeduplicationRate,
    },
  };
  
  // Write JSON report
  const jsonPath = join(reportsDir, 'image-dedup-summary.json');
  writeFileSync(jsonPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`✅ JSON report written: ${jsonPath}\n`);
  
  // Write Markdown report
  const mdPath = join(reportsDir, 'image-dedup-summary.md');
  const mdReport = generateMarkdownReport(report);
  writeFileSync(mdPath, mdReport, 'utf-8');
  console.log(`✅ Markdown report written: ${mdPath}\n`);
  
  // Print high-level summary
  console.log('='.repeat(80));
  console.log('HIGH-LEVEL RISK ASSESSMENT');
  console.log('='.repeat(80));
  console.log(`\nOverall Risk Level: ${riskAssessment.overallRisk.toUpperCase()}\n`);
  
  console.log('EDIT Mode Image Loss Cases:');
  if (riskAssessment.editModeImageLoss.count === 0) {
    console.log('  ✅ No cases detected\n');
  } else {
    console.log(`  ⚠️  ${riskAssessment.editModeImageLoss.count} cases found:\n`);
    for (const case_ of riskAssessment.editModeImageLoss.cases.slice(0, 5)) {
      console.log(`    - ${case_.timestamp} | Article: ${case_.articleId || 'N/A'}`);
      console.log(`      Input: ${case_.inputImages} → Output: ${case_.outputImages} (Removed: ${case_.removed}, Moved: ${case_.moved})`);
    }
    if (riskAssessment.editModeImageLoss.cases.length > 5) {
      console.log(`    ... and ${riskAssessment.editModeImageLoss.cases.length - 5} more cases`);
    }
    console.log('');
  }
  
  console.log('Behavior Change Risk Patterns:');
  if (riskAssessment.behaviorChangeRisks.length === 0) {
    console.log('  ✅ No significant risks identified\n');
  } else {
    for (const risk of riskAssessment.behaviorChangeRisks) {
      console.log(`  ⚠️  ${risk}`);
    }
    console.log('');
  }
  
  console.log('Recommendations:');
  for (const rec of riskAssessment.recommendations) {
    console.log(`  ${rec}`);
  }
  console.log('\n' + '='.repeat(80));
  console.log(`\nReports saved to:`);
  console.log(`  - ${jsonPath}`);
  console.log(`  - ${mdPath}\n`);
}

// Run if executed directly
main();

export { main };

