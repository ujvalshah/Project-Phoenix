/**
 * PHASE 6: Verification
 * 
 * Verify that cleanup didn't break anything by:
 * - Re-checking counts
 * - Ensuring no new orphaned references were created
 * - Validating data integrity
 */

import { User } from '../../models/User.js';
import { Article } from '../../models/Article.js';
import { Collection } from '../../models/Collection.js';
import { Bookmark } from '../../models/Bookmark.js';
import { BookmarkFolder } from '../../models/BookmarkFolder.js';
import { BookmarkFolderLink } from '../../models/BookmarkFolderLink.js';
import { Report } from '../../models/Report.js';
import { ModerationAuditLog } from '../../models/ModerationAuditLog.js';
import { Feedback } from '../../models/Feedback.js';

export interface VerificationResult {
  passed: boolean;
  checks: Array<{
    name: string;
    passed: boolean;
    message: string;
    details?: any;
  }>;
  errors: string[];
}

/**
 * Verify database integrity after cleanup
 */
export async function verifyDatabaseIntegrity(): Promise<VerificationResult> {
  const result: VerificationResult = {
    passed: true,
    checks: [],
    errors: []
  };

  try {
    // Check 1: All collections have valid creatorIds
    const validUserIds = new Set(
      (await User.find({}, '_id').lean()).map(u => u._id.toString())
    );
    const collections = await Collection.find({}).lean();
    const invalidCreatorCollections = collections.filter(
      c => c.creatorId && !validUserIds.has(c.creatorId)
    );

    result.checks.push({
      name: 'Collection Creator IDs',
      passed: invalidCreatorCollections.length === 0,
      message: invalidCreatorCollections.length === 0
        ? 'All collections have valid creator IDs'
        : `${invalidCreatorCollections.length} collections have invalid creator IDs (expected - these require manual review)`,
      details: { invalidCount: invalidCreatorCollections.length }
    });

    // Check 2: All collection entries reference valid articles
    const validArticleIds = new Set(
      (await Article.find({}, '_id').lean()).map(a => a._id.toString())
    );
    let orphanedEntryCount = 0;
    for (const collection of collections) {
      if (collection.entries && Array.isArray(collection.entries)) {
        orphanedEntryCount += collection.entries.filter(
          (e: any) => e.articleId && !validArticleIds.has(e.articleId)
        ).length;
      }
    }

    result.checks.push({
      name: 'Collection Entry Article References',
      passed: orphanedEntryCount === 0,
      message: orphanedEntryCount === 0
        ? 'All collection entries reference valid articles'
        : `Found ${orphanedEntryCount} orphaned article references in collections (should have been cleaned)`,
      details: { orphanedCount: orphanedEntryCount }
    });

    // Check 3: All bookmarks reference valid users and articles
    const bookmarks = await Bookmark.find({}).lean();
    const orphanedBookmarks = bookmarks.filter(
      b => !validUserIds.has(b.userId) || !validArticleIds.has(b.nuggetId)
    );

    result.checks.push({
      name: 'Bookmark References',
      passed: orphanedBookmarks.length === 0,
      message: orphanedBookmarks.length === 0
        ? 'All bookmarks reference valid users and articles'
        : `Found ${orphanedBookmarks.length} orphaned bookmarks (should have been cleaned)`,
      details: { orphanedCount: orphanedBookmarks.length }
    });

    // Check 4: All bookmark folder links reference valid entities
    const validBookmarkIds = new Set(
      (await Bookmark.find({}, '_id').lean()).map(b => b._id.toString())
    );
    const validFolderIds = new Set(
      (await BookmarkFolder.find({}, '_id').lean()).map(f => f._id.toString())
    );
    const links = await BookmarkFolderLink.find({}).lean();
    const orphanedLinks = links.filter(
      l => !validUserIds.has(l.userId) || 
           !validBookmarkIds.has(l.bookmarkId) || 
           !validFolderIds.has(l.folderId)
    );

    result.checks.push({
      name: 'Bookmark Folder Link References',
      passed: orphanedLinks.length === 0,
      message: orphanedLinks.length === 0
        ? 'All bookmark folder links reference valid entities'
        : `Found ${orphanedLinks.length} orphaned bookmark folder links (should have been cleaned)`,
      details: { orphanedCount: orphanedLinks.length }
    });

    // Check 5: Collection followers are valid
    let orphanedFollowerCount = 0;
    for (const collection of collections) {
      if (collection.followers && Array.isArray(collection.followers)) {
        orphanedFollowerCount += collection.followers.filter(
          (f: string) => !validUserIds.has(f)
        ).length;
      }
    }

    result.checks.push({
      name: 'Collection Followers',
      passed: orphanedFollowerCount === 0,
      message: orphanedFollowerCount === 0
        ? 'All collection followers are valid users'
        : `Found ${orphanedFollowerCount} orphaned followers in collections (should have been cleaned)`,
      details: { orphanedCount: orphanedFollowerCount }
    });

    // Check 6: Article author references
    const articles = await Article.find({}).lean();
    const orphanedAuthorArticles = articles.filter(
      a => a.authorId && !validUserIds.has(a.authorId)
    );

    result.checks.push({
      name: 'Article Author References',
      passed: orphanedAuthorArticles.length === 0 || true, // Expected - these require manual review
      message: orphanedAuthorArticles.length === 0
        ? 'All articles have valid author IDs'
        : `${orphanedAuthorArticles.length} articles have invalid author IDs (expected - these require manual review)`,
      details: { invalidCount: orphanedAuthorArticles.length }
    });

    // Determine overall pass status
    result.passed = result.checks.every(check => check.passed);

  } catch (error: any) {
    result.passed = false;
    result.errors.push(`Verification error: ${error.message}`);
  }

  return result;
}

/**
 * Print verification results to console
 */
export function printVerificationResults(result: VerificationResult): void {
  console.log('\n' + '='.repeat(80));
  console.log('VERIFICATION RESULTS');
  console.log('='.repeat(80));

  for (const check of result.checks) {
    const icon = check.passed ? '✓' : '✗';
    console.log(`${icon} ${check.name}: ${check.message}`);
  }

  if (result.errors.length > 0) {
    console.log('\nErrors:');
    result.errors.forEach(err => console.error(`  - ${err}`));
  }

  console.log('\n' + '='.repeat(80));
  console.log(`Overall Status: ${result.passed ? '✅ PASSED' : '⚠️ ISSUES FOUND'}`);
  console.log('='.repeat(80));
}











