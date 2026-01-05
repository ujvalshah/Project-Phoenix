/**
 * TODO: LEGACY MIGRATION SCRIPT - Can be removed after migration is complete
 * Verification Script for Category to Tag Migration
 * 
 * Verifies that the migration was applied correctly by checking
 * a sample of articles from the migration report.
 */

import '../loadEnv.js';
import { validateEnv } from '../config/envValidation.js';
validateEnv();

import { initLogger } from '../utils/logger.js';
initLogger();

import mongoose from 'mongoose';
import { connectDB } from '../utils/db.js';
import { Article } from '../models/Article.js';
import { readFileSync } from 'fs';
import { join } from 'path';

interface MigrationResult {
  articleId: string;
  title: string;
  before: {
    tags: string[];
    categories?: string[];
  };
  after: {
    tags: string[];
    categories?: string[];
  };
}

interface VerificationResult {
  articleId: string;
  title: string;
  verified: boolean;
  expectedTags: string[];
  actualTags: string[];
  expectedCategories?: string[];
  actualCategories?: string[];
  errors: string[];
}

async function verifyMigration(): Promise<void> {
  console.log('='.repeat(80));
  console.log('CATEGORY TO TAG MIGRATION VERIFICATION');
  console.log('='.repeat(80));
  console.log();

  try {
    await connectDB();
    console.log('[Verification] Database connected\n');

    // Find the most recent apply report
    const reportsDir = join(process.cwd(), 'reports');
    const fs = await import('fs/promises');
    const files = await fs.readdir(reportsDir);
    const applyReports = files
      .filter(f => f.startsWith('category-to-tag-migration-apply-') && f.endsWith('.json'))
      .sort()
      .reverse();

    if (applyReports.length === 0) {
      console.error('[Verification] No apply reports found. Run the migration first.');
      await mongoose.connection.close();
      process.exit(1);
    }

    const latestReportPath = join(reportsDir, applyReports[0]);
    console.log(`[Verification] Loading report: ${applyReports[0]}\n`);

    const reportData = JSON.parse(readFileSync(latestReportPath, 'utf-8'));
    const affectedRecords: MigrationResult[] = reportData.affectedRecords || [];

    if (affectedRecords.length === 0) {
      console.log('[Verification] No records to verify.');
      await mongoose.connection.close();
      return;
    }

    // Select 10 random records (or all if less than 10)
    const sampleSize = Math.min(10, affectedRecords.length);
    const shuffled = [...affectedRecords].sort(() => 0.5 - Math.random());
    const samples = shuffled.slice(0, sampleSize);

    console.log(`[Verification] Verifying ${sampleSize} sample records...\n`);

    const verificationResults: VerificationResult[] = [];

    for (const sample of samples) {
      try {
        const article = await Article.findById(sample.articleId).lean();
        if (!article) {
          verificationResults.push({
            articleId: sample.articleId,
            title: sample.title,
            verified: false,
            expectedTags: sample.after.tags,
            actualTags: [],
            expectedCategories: sample.after.categories,
            actualCategories: undefined,
            errors: ['Article not found'],
          });
          continue;
        }

        const actualTags = Array.isArray(article.tags) ? [...article.tags].sort() : [];
        const expectedTags = [...sample.after.tags].sort();
        const actualCategories = Array.isArray(article.categories) ? [...article.categories].sort() : undefined;
        const expectedCategories = sample.after.categories ? [...sample.after.categories].sort() : undefined;

        const errors: string[] = [];
        const tagsMatch = JSON.stringify(actualTags) === JSON.stringify(expectedTags);
        const categoriesMatch = JSON.stringify(actualCategories) === JSON.stringify(expectedCategories);

        if (!tagsMatch) {
          errors.push(`Tags mismatch: expected ${JSON.stringify(expectedTags)}, got ${JSON.stringify(actualTags)}`);
        }
        if (!categoriesMatch) {
          errors.push(`Categories mismatch: expected ${JSON.stringify(expectedCategories)}, got ${JSON.stringify(actualCategories)}`);
        }

        verificationResults.push({
          articleId: sample.articleId,
          title: sample.title,
          verified: tagsMatch && categoriesMatch,
          expectedTags: sample.after.tags,
          actualTags: Array.isArray(article.tags) ? article.tags : [],
          expectedCategories: sample.after.categories,
          actualCategories: Array.isArray(article.categories) ? article.categories : undefined,
          errors,
        });
      } catch (error: any) {
        verificationResults.push({
          articleId: sample.articleId,
          title: sample.title,
          verified: false,
          expectedTags: sample.after.tags,
          actualTags: [],
          expectedCategories: sample.after.categories,
          actualCategories: undefined,
          errors: [`Error querying article: ${error.message}`],
        });
      }
    }

    // Print results
    console.log('VERIFICATION RESULTS');
    console.log('='.repeat(80));
    console.log();

    const verifiedCount = verificationResults.filter(r => r.verified).length;
    const failedCount = verificationResults.filter(r => !r.verified).length;

    console.log(`Verified: ${verifiedCount}/${sampleSize}`);
    console.log(`Failed: ${failedCount}/${sampleSize}`);
    console.log();

    if (failedCount > 0) {
      console.log('FAILED VERIFICATIONS:');
      console.log('-'.repeat(80));
      verificationResults
        .filter(r => !r.verified)
        .forEach((r, idx) => {
          console.log(`\n${idx + 1}. Article ID: ${r.articleId}`);
          console.log(`   Title: ${r.title}`);
          console.log(`   Errors: ${r.errors.join(', ')}`);
          console.log(`   Expected Tags: ${JSON.stringify(r.expectedTags)}`);
          console.log(`   Actual Tags: ${JSON.stringify(r.actualTags)}`);
        });
      console.log();
    }

    // Show successful verifications
    if (verifiedCount > 0) {
      console.log('SUCCESSFUL VERIFICATIONS:');
      console.log('-'.repeat(80));
      verificationResults
        .filter(r => r.verified)
        .slice(0, 5) // Show first 5
        .forEach((r, idx) => {
          console.log(`\n${idx + 1}. Article ID: ${r.articleId}`);
          console.log(`   Title: ${r.title}`);
          console.log(`   Tags: ${JSON.stringify(r.actualTags)}`);
        });
      if (verifiedCount > 5) {
        console.log(`\n... and ${verifiedCount - 5} more successful verifications`);
      }
      console.log();
    }

    console.log('='.repeat(80));
    if (failedCount === 0) {
      console.log('✅ ALL VERIFICATIONS PASSED');
    } else {
      console.log(`⚠️  ${failedCount} VERIFICATION(S) FAILED`);
    }
    console.log('='.repeat(80));

    await mongoose.connection.close();
    console.log('\n[Verification] Database connection closed.\n');

    process.exit(failedCount > 0 ? 1 : 0);
  } catch (error: any) {
    console.error('[Verification] ERROR:', error.message);
    console.error(error.stack);

    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }

    process.exit(1);
  }
}

verifyMigration();

