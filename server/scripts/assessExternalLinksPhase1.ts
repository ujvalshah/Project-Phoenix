/**
 * Phase 1 Assessment Script: External Links Recovery
 * 
 * This script assesses the database state to determine:
 * - How many articles have externalLinks[] populated (Bucket A)
 * - How many articles have legacy URLs but no externalLinks (Bucket B - recoverable)
 * - How many articles have no URLs anywhere (Bucket C - lost)
 * 
 * Usage:
 *   npx ts-node server/scripts/assessExternalLinksPhase1.ts [--detailed] [--export-ids]
 * 
 * Options:
 *   --detailed    Show detailed breakdown per article
 *   --export-ids  Export article IDs to JSON files (bucket-a-ids.json, etc.)
 * 
 * This is a READ-ONLY assessment script - no data modification.
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { Article } from '../src/models/Article.js';
import fs from 'fs';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootPath = path.resolve(__dirname, '../..');
dotenv.config({ path: path.join(rootPath, '.env') });

// Direct MongoDB connection for scripts (avoids logger initialization)
async function connectToDatabase(): Promise<void> {
  const MONGO_URI = process.env.MONGO_URI || process.env.MONGODB_URI;
  
  if (!MONGO_URI) {
    throw new Error('MONGO_URI or MONGODB_URI environment variable is required');
  }

  let connectionString = MONGO_URI;
  const dbNameMatch = connectionString.match(/mongodb\+?srv?:\/\/[^\/]+\/([^\/\?]+)/);
  if (!dbNameMatch || dbNameMatch[1] === '') {
    if (connectionString.includes('/?')) {
      connectionString = connectionString.replace('/?', '/nuggets?');
    } else if (connectionString.includes('?')) {
      connectionString = connectionString.replace('?', '/nuggets?');
    } else {
      connectionString = connectionString + '/nuggets';
    }
  }

  await mongoose.connect(connectionString);
  console.log('[Phase1 Assessment] Database connected');
}

interface ArticleAssessment {
  id: string;
  title: string;
  bucket: 'A' | 'B' | 'C';
  hasExternalLinks: boolean;
  externalLinksCount: number;
  hasMediaUrl: boolean;
  hasPreviewMetadataUrl: boolean;
  mediaUrl?: string;
  previewMetadataUrl?: string;
}

interface AssessmentResult {
  bucketA: ArticleAssessment[];
  bucketB: ArticleAssessment[];
  bucketC: ArticleAssessment[];
  summary: {
    total: number;
    bucketA: number;
    bucketB: number;
    bucketC: number;
    bucketAPercent: number;
    bucketBPercent: number;
    bucketCPercent: number;
  };
}

function classifyArticle(article: any): ArticleAssessment {
  const id = article._id.toString();
  const title = article.title || '(no title)';
  
  // Check for externalLinks
  const externalLinks = article.externalLinks || [];
  const hasExternalLinks = Array.isArray(externalLinks) && externalLinks.length > 0;
  const externalLinksCount = Array.isArray(externalLinks) ? externalLinks.length : 0;
  
  // Check for legacy URLs
  const mediaUrl = article.media?.url;
  const previewMetadataUrl = article.media?.previewMetadata?.url;
  const hasMediaUrl = !!mediaUrl;
  const hasPreviewMetadataUrl = !!previewMetadataUrl;
  
  // Classify into buckets
  let bucket: 'A' | 'B' | 'C';
  if (hasExternalLinks) {
    bucket = 'A'; // Already migrated
  } else if (hasMediaUrl || hasPreviewMetadataUrl) {
    bucket = 'B'; // Recoverable
  } else {
    bucket = 'C'; // Lost
  }
  
  return {
    id,
    title,
    bucket,
    hasExternalLinks,
    externalLinksCount,
    hasMediaUrl,
    hasPreviewMetadataUrl,
    mediaUrl: mediaUrl || undefined,
    previewMetadataUrl: previewMetadataUrl || undefined,
  };
}

async function assessExternalLinks(): Promise<void> {
  try {
    console.log('[Phase1 Assessment] Connecting to database...');
    await connectToDatabase();
    
    console.log('[Phase1 Assessment] Fetching all articles...');
    const articles = await Article.find({});
    console.log(`[Phase1 Assessment] Found ${articles.length} total articles`);
    
    // Classify all articles
    const assessments: ArticleAssessment[] = articles.map(classifyArticle);
    
    // Group by bucket
    const bucketA = assessments.filter(a => a.bucket === 'A');
    const bucketB = assessments.filter(a => a.bucket === 'B');
    const bucketC = assessments.filter(a => a.bucket === 'C');
    
    // Calculate summary
    const total = assessments.length;
    const result: AssessmentResult = {
      bucketA,
      bucketB,
      bucketC,
      summary: {
        total,
        bucketA: bucketA.length,
        bucketB: bucketB.length,
        bucketC: bucketC.length,
        bucketAPercent: total > 0 ? Math.round((bucketA.length / total) * 100 * 100) / 100 : 0,
        bucketBPercent: total > 0 ? Math.round((bucketB.length / total) * 100 * 100) / 100 : 0,
        bucketCPercent: total > 0 ? Math.round((bucketC.length / total) * 100 * 100) / 100 : 0,
      },
    };
    
    // Print summary
    console.log('\n' + '='.repeat(70));
    console.log('PHASE 1 ASSESSMENT: External Links Database State');
    console.log('='.repeat(70));
    console.log(`\nTotal Articles: ${result.summary.total}`);
    console.log('\nBucket Classification:');
    console.log(`  📦 Bucket A (Already Migrated):     ${result.summary.bucketA.toString().padStart(6)} (${result.summary.bucketAPercent}%)`);
    console.log(`     └─ Articles with externalLinks[] populated`);
    console.log(`  📦 Bucket B (Recoverable):          ${result.summary.bucketB.toString().padStart(6)} (${result.summary.bucketBPercent}%)`);
    console.log(`     └─ Articles with legacy URLs but no externalLinks[]`);
    console.log(`  📦 Bucket C (Lost):                 ${result.summary.bucketC.toString().padStart(6)} (${result.summary.bucketCPercent}%)`);
    console.log(`     └─ Articles with no URLs anywhere`);
    console.log('\n' + '='.repeat(70));
    
    // Detailed output
    const args = process.argv.slice(2);
    const detailed = args.includes('--detailed');
    const exportIds = args.includes('--export-ids');
    
    if (detailed) {
      console.log('\n📦 BUCKET A - Already Migrated (Sample):');
      bucketA.slice(0, 10).forEach(article => {
        console.log(`  • ${article.id} - "${article.title}" (${article.externalLinksCount} links)`);
      });
      if (bucketA.length > 10) {
        console.log(`  ... and ${bucketA.length - 10} more`);
      }
      
      console.log('\n📦 BUCKET B - Recoverable (Sample):');
      bucketB.slice(0, 10).forEach(article => {
        const url = article.mediaUrl || article.previewMetadataUrl || '(unknown)';
        console.log(`  • ${article.id} - "${article.title}"`);
        console.log(`    └─ Legacy URL: ${url}`);
      });
      if (bucketB.length > 10) {
        console.log(`  ... and ${bucketB.length - 10} more`);
      }
      
      console.log('\n📦 BUCKET C - Lost (Sample):');
      bucketC.slice(0, 10).forEach(article => {
        console.log(`  • ${article.id} - "${article.title}"`);
      });
      if (bucketC.length > 10) {
        console.log(`  ... and ${bucketC.length - 10} more`);
      }
    }
    
    // Export IDs if requested
    if (exportIds) {
      const exportDir = path.join(rootPath, 'server/scripts/phase1-assessment');
      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
      }
      
      fs.writeFileSync(
        path.join(exportDir, 'bucket-a-ids.json'),
        JSON.stringify(bucketA.map(a => ({ id: a.id, title: a.title })), null, 2)
      );
      
      fs.writeFileSync(
        path.join(exportDir, 'bucket-b-ids.json'),
        JSON.stringify(bucketB.map(a => ({ 
          id: a.id, 
          title: a.title,
          legacyUrl: a.mediaUrl || a.previewMetadataUrl
        })), null, 2)
      );
      
      fs.writeFileSync(
        path.join(exportDir, 'bucket-c-ids.json'),
        JSON.stringify(bucketC.map(a => ({ id: a.id, title: a.title })), null, 2)
      );
      
      fs.writeFileSync(
        path.join(exportDir, 'assessment-summary.json'),
        JSON.stringify(result.summary, null, 2)
      );
      
      console.log(`\n✅ Exported article IDs to: ${exportDir}/`);
      console.log(`   - bucket-a-ids.json (${bucketA.length} articles)`);
      console.log(`   - bucket-b-ids.json (${bucketB.length} articles)`);
      console.log(`   - bucket-c-ids.json (${bucketC.length} articles)`);
      console.log(`   - assessment-summary.json`);
    }
    
    // Recommendations
    console.log('\n📋 Recommendations:');
    if (result.summary.bucketB > 0) {
      console.log(`  ✅ ${result.summary.bucketB} articles can be recovered (Phase 2 migration)`);
    }
    if (result.summary.bucketC > 0) {
      console.log(`  ⚠️  ${result.summary.bucketC} articles have no recoverable link data`);
    }
    if (result.summary.bucketA === result.summary.total) {
      console.log(`  ✅ All articles already have externalLinks[] - no migration needed`);
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('[Phase1 Assessment] ✓ Assessment complete');
    console.log('='.repeat(70) + '\n');
    
    await mongoose.connection.close();
    process.exit(0);
  } catch (error: any) {
    console.error('[Phase1 Assessment] Error:', error);
    console.error(error.stack);
    await mongoose.connection.close();
    process.exit(1);
  }
}

// Run assessment
assessExternalLinks();
