/**
 * Tag & Article Taxonomy Data Audit Script
 * 
 * SAFE READ-ONLY AUDIT - No modifications or deletions performed
 * 
 * This script performs comprehensive read-only inspection of:
 * - Tag collection data integrity
 * - Article tag references
 * - Legacy field usage
 * 
 * Usage:
 *   npx tsx server/src/scripts/auditTagsData.ts
 */

// IMPORTANT: Load environment variables FIRST before any other imports
import '../loadEnv.js';

// CRITICAL: Validate environment variables BEFORE any other imports
import { validateEnv } from '../config/envValidation.js';
validateEnv();

// Initialize Logger early (after validateEnv, before other imports that might log)
import { initLogger } from '../utils/logger.js';
initLogger();

import mongoose from 'mongoose';
import { connectDB } from '../utils/db.js';
import { Tag } from '../models/Tag.js';
import { Article } from '../models/Article.js';

interface TagSample {
  id: string;
  rawName?: string;
  name?: string;
  canonicalName?: string;
  normalizedName?: string;
  status?: string;
  type?: string;
  isOfficial?: boolean;
}

interface ArticleSample {
  id: string;
  title?: string;
  tags?: string[];
  categories?: string[];
}

/**
 * Main audit function
 */
async function auditTagsData(): Promise<void> {
  console.log('\n' + '='.repeat(80));
  console.log('--- TAG AUDIT REPORT ---');
  console.log('='.repeat(80) + '\n');

  try {
    // Connect to database
    if (mongoose.connection.readyState === 0) {
      await connectDB();
    }
    console.log('[Audit] Database connected\n');

    // ============================================================================
    // A) List all tags with raw fields
    // ============================================================================
    console.log('[A] Listing all tags with raw fields...');
    const allTags = await Tag.find({}).lean();
    const totalTags = allTags.length;
    console.log(`Total tags: ${totalTags}\n`);

    if (totalTags > 0) {
      console.log('Sample tags (first 20):');
      console.log('-'.repeat(80));
      const samples = allTags.slice(0, 20).map(tag => ({
        id: tag._id?.toString() || 'unknown',
        rawName: tag.rawName || '(missing)',
        name: tag.name || '(missing)',
        canonicalName: tag.canonicalName || '(missing)',
        normalizedName: (tag as any).normalizedName || '(missing)',
        status: tag.status || '(missing)',
        type: tag.type || '(missing)',
        isOfficial: tag.isOfficial || false,
      }));

      samples.forEach((tag, idx) => {
        console.log(`${idx + 1}. ID: ${tag.id}`);
        console.log(`   rawName: ${tag.rawName}`);
        console.log(`   name (legacy): ${tag.name}`);
        console.log(`   canonicalName: ${tag.canonicalName}`);
        console.log(`   normalizedName: ${tag.normalizedName}`);
        console.log(`   status: ${tag.status}`);
        console.log(`   type (legacy): ${tag.type}`);
        console.log(`   isOfficial: ${tag.isOfficial}`);
        console.log('');
      });
    }
    console.log('');

    // ============================================================================
    // B) Detect mixed-case / duplicate variants
    // ============================================================================
    console.log('[Duplicates]');
    console.log('-'.repeat(80));
    
    // Group tags by lowercase name (check both rawName and name)
    const nameGroups = new Map<string, TagSample[]>();
    
    for (const tag of allTags) {
      const rawName = tag.rawName || tag.name || '';
      if (rawName) {
        const key = rawName.toLowerCase();
        if (!nameGroups.has(key)) {
          nameGroups.set(key, []);
        }
        nameGroups.get(key)!.push({
          id: tag._id?.toString() || 'unknown',
          rawName: tag.rawName,
          name: tag.name,
          canonicalName: tag.canonicalName,
          normalizedName: (tag as any).normalizedName,
          status: tag.status,
          type: tag.type,
          isOfficial: tag.isOfficial,
        });
      }
    }

    // Find groups with duplicates
    const duplicateGroups: Array<{ key: string; variants: TagSample[] }> = [];
    for (const [key, variants] of nameGroups.entries()) {
      if (variants.length > 1) {
        duplicateGroups.push({ key, variants });
      }
    }

    console.log(`${duplicateGroups.length} groups found with duplicate variants\n`);

    if (duplicateGroups.length > 0) {
      const samples = duplicateGroups.slice(0, 20);
      samples.forEach((group, idx) => {
        console.log(`Group ${idx + 1} (normalized: "${group.key}"):`);
        group.variants.forEach(variant => {
          console.log(`  - ID: ${variant.id}, rawName: "${variant.rawName || variant.name || '(missing)'}", canonicalName: "${variant.canonicalName || '(missing)'}"`);
        });
        console.log('');
      });
    } else {
      console.log('No duplicate variants found.\n');
    }

    // ============================================================================
    // C) Detect records that still use legacy `type` values
    // ============================================================================
    console.log('[Legacy Type Tags]');
    console.log('-'.repeat(80));
    
    const legacyTypeTags = allTags.filter(tag => {
      // Check if type exists and is not "tag"
      return tag.type && tag.type !== 'tag';
    });

    console.log(`count = ${legacyTypeTags.length}\n`);

    if (legacyTypeTags.length > 0) {
      const samples = legacyTypeTags.slice(0, 20).map(tag => ({
        id: tag._id?.toString() || 'unknown',
        rawName: tag.rawName || tag.name || '(missing)',
        type: tag.type || '(missing)',
        status: tag.status || '(missing)',
      }));

      samples.forEach((tag, idx) => {
        console.log(`${idx + 1}. ID: ${tag.id}, rawName: "${tag.rawName}", type: "${tag.type}", status: "${tag.status}"`);
      });
      console.log('');
    } else {
      console.log('No tags with legacy type values found.\n');
    }

    // ============================================================================
    // D) Detect tags missing normalizedName (canonicalName)
    // ============================================================================
    console.log('[Missing normalizedName]');
    console.log('-'.repeat(80));
    
    const missingNormalizedName = allTags.filter(tag => {
      // Check for missing, null, or empty canonicalName or normalizedName
      const canonicalName = tag.canonicalName;
      const normalizedName = (tag as any).normalizedName;
      return !canonicalName || canonicalName === '' || canonicalName === null ||
             (!normalizedName && !canonicalName);
    });

    console.log(`count = ${missingNormalizedName.length}\n`);

    if (missingNormalizedName.length > 0) {
      const samples = missingNormalizedName.slice(0, 20).map(tag => ({
        id: tag._id?.toString() || 'unknown',
        rawName: tag.rawName || tag.name || '(missing)',
        canonicalName: tag.canonicalName || '(missing)',
        normalizedName: (tag as any).normalizedName || '(missing)',
        status: tag.status || '(missing)',
      }));

      samples.forEach((tag, idx) => {
        console.log(`${idx + 1}. ID: ${tag.id}, rawName: "${tag.rawName}", canonicalName: "${tag.canonicalName}", normalizedName: "${tag.normalizedName}"`);
      });
      console.log('');
    } else {
      console.log('No tags missing normalizedName found.\n');
    }

    // ============================================================================
    // E) Detect orphan tags (not referenced in ANY article.tags array)
    // ============================================================================
    console.log('[Orphan Tags]');
    console.log('-'.repeat(80));
    
    // Get all unique tag strings from articles
    const allArticleTags = await Article.distinct('tags');
    const articleTagSet = new Set<string>();
    
    // Normalize all article tags to lowercase for comparison
    for (const tagStr of allArticleTags) {
      if (typeof tagStr === 'string' && tagStr.trim()) {
        articleTagSet.add(tagStr.toLowerCase().trim());
      }
    }

    // Find tags that are not referenced in any article
    const orphanTags: TagSample[] = [];
    
    for (const tag of allTags) {
      const tagName = tag.rawName || tag.name || '';
      const canonicalName = tag.canonicalName || '';
      
      if (tagName) {
        // Check if any article references this tag (case-insensitive)
        const isReferenced = articleTagSet.has(tagName.toLowerCase().trim()) ||
                            (canonicalName && articleTagSet.has(canonicalName.toLowerCase().trim()));
        
        if (!isReferenced) {
          orphanTags.push({
            id: tag._id?.toString() || 'unknown',
            rawName: tag.rawName,
            name: tag.name,
            canonicalName: tag.canonicalName,
            normalizedName: (tag as any).normalizedName,
            status: tag.status,
            type: tag.type,
            isOfficial: tag.isOfficial,
          });
        }
      }
    }

    console.log(`count = ${orphanTags.length}\n`);

    if (orphanTags.length > 0) {
      const samples = orphanTags.slice(0, 20);
      samples.forEach((tag, idx) => {
        console.log(`${idx + 1}. ID: ${tag.id}, rawName: "${tag.rawName || tag.name || '(missing)'}", canonicalName: "${tag.canonicalName || '(missing)'}", status: "${tag.status || '(missing)'}"`);
      });
      console.log('');
    } else {
      console.log('No orphan tags found.\n');
    }

    // ============================================================================
    // F) Detect articles still using legacy `categories`
    // ============================================================================
    console.log('[Articles still using categories]');
    console.log('-'.repeat(80));
    
    // Find articles with categories field that is non-empty OR tags missing
    const articlesWithCategories = await Article.find({
      $or: [
        { categories: { $exists: true, $ne: [], $ne: null } },
        { tags: { $exists: false } },
        { tags: null },
        { tags: [] }
      ]
    }).lean().limit(1000); // Limit query for performance

    // Also check for articles where categories exists and is non-empty
    const articlesWithNonEmptyCategories = articlesWithCategories.filter(article => {
      const categories = (article as any).categories;
      const tags = article.tags;
      
      // Check if categories exists and is non-empty OR tags is missing/empty
      return (Array.isArray(categories) && categories.length > 0) ||
             !tags || !Array.isArray(tags) || tags.length === 0;
    });

    console.log(`count = ${articlesWithNonEmptyCategories.length}\n`);

    if (articlesWithNonEmptyCategories.length > 0) {
      const samples = articlesWithNonEmptyCategories.slice(0, 20).map(article => ({
        id: article._id?.toString() || 'unknown',
        title: article.title || '(No title)',
        tags: Array.isArray(article.tags) ? article.tags : [],
        categories: Array.isArray((article as any).categories) ? (article as any).categories : [],
      }));

      samples.forEach((article, idx) => {
        console.log(`${idx + 1}. ID: ${article.id}`);
        console.log(`   Title: ${article.title}`);
        console.log(`   Tags: [${article.tags.join(', ')}]`);
        console.log(`   Categories (legacy): [${article.categories.join(', ')}]`);
        console.log('');
      });
    } else {
      console.log('No articles using legacy categories found.\n');
    }

    // ============================================================================
    // Final Summary
    // ============================================================================
    console.log('='.repeat(80));
    console.log('Audit complete. No writes performed.');
    console.log('='.repeat(80) + '\n');

    // Close database connection
    if (mongoose.connection.readyState !== 0) {
      await mongoose.connection.close();
      console.log('[Audit] Database connection closed.\n');
    }

  } catch (error: any) {
    console.error('[Audit] ERROR:', error.message);
    console.error(error.stack);
    
    // Ensure we don't leave connections open
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.close();
    }
    
    process.exit(1);
  }
}

// Run audit if executed directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.includes('auditTagsData')) {
  auditTagsData()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('[Audit] Fatal error:', error);
      process.exit(1);
    });
}

export default auditTagsData;

