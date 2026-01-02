/**
 * PHASE 1: Discovery (Read-Only Audit)
 * 
 * Scans the database for orphaned references, stale entities, and invalid data.
 * NO DATA MODIFICATION - Read-only operations only.
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
import { Tag } from '../../models/Tag.js';
import { SanitizationIssue, IssueType, CleanupCategory } from './types.js';

/**
 * Get all user IDs that exist in the database
 */
async function getValidUserIds(): Promise<Set<string>> {
  const users = await User.find({}, '_id').lean();
  return new Set(users.map(u => u._id.toString()));
}

/**
 * Get all article IDs that exist in the database
 */
async function getValidArticleIds(): Promise<Set<string>> {
  const articles = await Article.find({}, '_id').lean();
  return new Set(articles.map(a => a._id.toString()));
}

/**
 * Get all bookmark IDs that exist in the database
 */
async function getValidBookmarkIds(): Promise<Set<string>> {
  const bookmarks = await Bookmark.find({}, '_id').lean();
  return new Set(bookmarks.map(b => b._id.toString()));
}

/**
 * Get all bookmark folder IDs that exist in the database
 */
async function getValidBookmarkFolderIds(): Promise<Set<string>> {
  const folders = await BookmarkFolder.find({}, '_id').lean();
  return new Set(folders.map(f => f._id.toString()));
}

/**
 * Discover orphaned references in Collections
 */
export async function discoverCollectionIssues(): Promise<SanitizationIssue[]> {
  const issues: SanitizationIssue[] = [];
  const validUserIds = await getValidUserIds();
  const validArticleIds = await getValidArticleIds();

  const collections = await Collection.find({}).lean();
  let orphanedArticleRefs = 0;
  let orphanedUserRefs = 0;
  let orphanedCreatorRefs = 0;
  let orphanedFollowerRefs = 0;
  const sampleCollectionIds: string[] = [];
  const sampleCreatorIds: string[] = [];
  const sampleFollowerIds: string[] = [];

  for (const collection of collections) {
    const collectionId = collection._id.toString();
    let hasIssues = false;

    // Check creatorId
    if (collection.creatorId && !validUserIds.has(collection.creatorId)) {
      orphanedCreatorRefs++;
      if (sampleCreatorIds.length < 5) {
        sampleCreatorIds.push(collection.creatorId);
      }
      hasIssues = true;
    }

    // Check followers array
    if (collection.followers && Array.isArray(collection.followers)) {
      const orphanedFollowers = collection.followers.filter(
        (followerId: string) => !validUserIds.has(followerId)
      );
      if (orphanedFollowers.length > 0) {
        orphanedFollowerRefs += orphanedFollowers.length;
        if (sampleFollowerIds.length < 5) {
          sampleFollowerIds.push(...orphanedFollowers.slice(0, 5 - sampleFollowerIds.length));
        }
        hasIssues = true;
      }
    }

    // Check entries array
    if (collection.entries && Array.isArray(collection.entries)) {
      const orphanedArticleEntries = collection.entries.filter(
        (entry: any) => entry.articleId && !validArticleIds.has(entry.articleId)
      );
      const orphanedUserEntries = collection.entries.filter(
        (entry: any) => entry.addedByUserId && !validUserIds.has(entry.addedByUserId)
      );

      if (orphanedArticleEntries.length > 0) {
        orphanedArticleRefs += orphanedArticleEntries.length;
        if (sampleCollectionIds.length < 5) {
          sampleCollectionIds.push(collectionId);
        }
        hasIssues = true;
      }

      if (orphanedUserEntries.length > 0) {
        orphanedUserRefs += orphanedUserEntries.length;
        if (sampleCollectionIds.length < 5 && !sampleCollectionIds.includes(collectionId)) {
          sampleCollectionIds.push(collectionId);
        }
        hasIssues = true;
      }
    }
  }

  if (orphanedArticleRefs > 0) {
    issues.push({
      collection: 'Collection',
      issueType: 'orphaned_reference',
      description: 'Collection entries referencing non-existent articles',
      count: orphanedArticleRefs,
      sampleIds: sampleCollectionIds.slice(0, 5),
      category: 'SAFE_AUTO_FIX',
      field: 'entries[].articleId',
      details: { sampleArticleIds: [] }
    });
  }

  if (orphanedUserRefs > 0) {
    issues.push({
      collection: 'Collection',
      issueType: 'orphaned_reference',
      description: 'Collection entries referencing non-existent users (addedByUserId)',
      count: orphanedUserRefs,
      sampleIds: sampleCollectionIds.slice(0, 5),
      category: 'SAFE_AUTO_FIX',
      field: 'entries[].addedByUserId'
    });
  }

  if (orphanedCreatorRefs > 0) {
    issues.push({
      collection: 'Collection',
      issueType: 'orphaned_reference',
      description: 'Collections with non-existent creatorId',
      count: orphanedCreatorRefs,
      sampleIds: sampleCreatorIds.slice(0, 5),
      category: 'CONDITIONAL_CLEANUP',
      field: 'creatorId',
      details: { note: 'Requires manual review - may need to reassign or delete collection' }
    });
  }

  if (orphanedFollowerRefs > 0) {
    issues.push({
      collection: 'Collection',
      issueType: 'orphaned_reference',
      description: 'Collections with non-existent followers',
      count: orphanedFollowerRefs,
      sampleIds: sampleFollowerIds.slice(0, 5),
      category: 'SAFE_AUTO_FIX',
      field: 'followers[]'
    });
  }

  return issues;
}

/**
 * Discover orphaned references in Bookmarks
 */
export async function discoverBookmarkIssues(): Promise<SanitizationIssue[]> {
  const issues: SanitizationIssue[] = [];
  const validUserIds = await getValidUserIds();
  const validArticleIds = await getValidArticleIds();

  const bookmarks = await Bookmark.find({}).lean();
  let orphanedUserRefs = 0;
  let orphanedArticleRefs = 0;
  const sampleBookmarkIds: string[] = [];
  const sampleUserIds: string[] = [];
  const sampleArticleIds: string[] = [];

  for (const bookmark of bookmarks) {
    const bookmarkId = bookmark._id.toString();
    let hasIssues = false;

    if (!validUserIds.has(bookmark.userId)) {
      orphanedUserRefs++;
      if (sampleUserIds.length < 5) {
        sampleUserIds.push(bookmark.userId);
      }
      if (sampleBookmarkIds.length < 5) {
        sampleBookmarkIds.push(bookmarkId);
      }
      hasIssues = true;
    }

    if (!validArticleIds.has(bookmark.nuggetId)) {
      orphanedArticleRefs++;
      if (sampleArticleIds.length < 5) {
        sampleArticleIds.push(bookmark.nuggetId);
      }
      if (sampleBookmarkIds.length < 5 && !sampleBookmarkIds.includes(bookmarkId)) {
        sampleBookmarkIds.push(bookmarkId);
      }
      hasIssues = true;
    }
  }

  if (orphanedUserRefs > 0) {
    issues.push({
      collection: 'Bookmark',
      issueType: 'orphaned_reference',
      description: 'Bookmarks referencing non-existent users',
      count: orphanedUserRefs,
      sampleIds: sampleBookmarkIds.slice(0, 5),
      category: 'SAFE_AUTO_FIX',
      field: 'userId'
    });
  }

  if (orphanedArticleRefs > 0) {
    issues.push({
      collection: 'Bookmark',
      issueType: 'orphaned_reference',
      description: 'Bookmarks referencing non-existent articles',
      count: orphanedArticleRefs,
      sampleIds: sampleBookmarkIds.slice(0, 5),
      category: 'SAFE_AUTO_FIX',
      field: 'nuggetId'
    });
  }

  return issues;
}

/**
 * Discover orphaned references in BookmarkFolders
 */
export async function discoverBookmarkFolderIssues(): Promise<SanitizationIssue[]> {
  const issues: SanitizationIssue[] = [];
  const validUserIds = await getValidUserIds();

  const folders = await BookmarkFolder.find({}).lean();
  let orphanedUserRefs = 0;
  const sampleFolderIds: string[] = [];
  const sampleUserIds: string[] = [];

  for (const folder of folders) {
    if (!validUserIds.has(folder.userId)) {
      orphanedUserRefs++;
      if (sampleUserIds.length < 5) {
        sampleUserIds.push(folder.userId);
      }
      if (sampleFolderIds.length < 5) {
        sampleFolderIds.push(folder._id.toString());
      }
    }
  }

  if (orphanedUserRefs > 0) {
    issues.push({
      collection: 'BookmarkFolder',
      issueType: 'orphaned_reference',
      description: 'Bookmark folders referencing non-existent users',
      count: orphanedUserRefs,
      sampleIds: sampleFolderIds.slice(0, 5),
      category: 'SAFE_AUTO_FIX',
      field: 'userId'
    });
  }

  return issues;
}

/**
 * Discover orphaned references in BookmarkFolderLinks
 */
export async function discoverBookmarkFolderLinkIssues(): Promise<SanitizationIssue[]> {
  const issues: SanitizationIssue[] = [];
  const validUserIds = await getValidUserIds();
  const validBookmarkIds = await getValidBookmarkIds();
  const validFolderIds = await getValidBookmarkFolderIds();

  const links = await BookmarkFolderLink.find({}).lean();
  let orphanedUserRefs = 0;
  let orphanedBookmarkRefs = 0;
  let orphanedFolderRefs = 0;
  const sampleLinkIds: string[] = [];
  const sampleBookmarkIds: string[] = [];
  const sampleFolderIds: string[] = [];

  for (const link of links) {
    const linkId = link._id.toString();
    let hasIssues = false;

    if (!validUserIds.has(link.userId)) {
      orphanedUserRefs++;
      if (sampleLinkIds.length < 5) {
        sampleLinkIds.push(linkId);
      }
      hasIssues = true;
    }

    if (!validBookmarkIds.has(link.bookmarkId)) {
      orphanedBookmarkRefs++;
      if (sampleBookmarkIds.length < 5) {
        sampleBookmarkIds.push(link.bookmarkId);
      }
      if (sampleLinkIds.length < 5 && !sampleLinkIds.includes(linkId)) {
        sampleLinkIds.push(linkId);
      }
      hasIssues = true;
    }

    if (!validFolderIds.has(link.folderId)) {
      orphanedFolderRefs++;
      if (sampleFolderIds.length < 5) {
        sampleFolderIds.push(link.folderId);
      }
      if (sampleLinkIds.length < 5 && !sampleLinkIds.includes(linkId)) {
        sampleLinkIds.push(linkId);
      }
      hasIssues = true;
    }
  }

  if (orphanedUserRefs > 0) {
    issues.push({
      collection: 'BookmarkFolderLink',
      issueType: 'orphaned_reference',
      description: 'Bookmark folder links referencing non-existent users',
      count: orphanedUserRefs,
      sampleIds: sampleLinkIds.slice(0, 5),
      category: 'SAFE_AUTO_FIX',
      field: 'userId'
    });
  }

  if (orphanedBookmarkRefs > 0) {
    issues.push({
      collection: 'BookmarkFolderLink',
      issueType: 'orphaned_reference',
      description: 'Bookmark folder links referencing non-existent bookmarks',
      count: orphanedBookmarkRefs,
      sampleIds: sampleLinkIds.slice(0, 5),
      category: 'SAFE_AUTO_FIX',
      field: 'bookmarkId'
    });
  }

  if (orphanedFolderRefs > 0) {
    issues.push({
      collection: 'BookmarkFolderLink',
      issueType: 'orphaned_reference',
      description: 'Bookmark folder links referencing non-existent folders',
      count: orphanedFolderRefs,
      sampleIds: sampleLinkIds.slice(0, 5),
      category: 'SAFE_AUTO_FIX',
      field: 'folderId'
    });
  }

  return issues;
}

/**
 * Discover orphaned references in Articles
 */
export async function discoverArticleIssues(): Promise<SanitizationIssue[]> {
  const issues: SanitizationIssue[] = [];
  const validUserIds = await getValidUserIds();

  const articles = await Article.find({}).lean();
  let orphanedAuthorRefs = 0;
  let missingRequiredFields = 0;
  const sampleArticleIds: string[] = [];
  const sampleAuthorIds: string[] = [];
  const missingFieldIds: string[] = [];

  for (const article of articles) {
    const articleId = article._id.toString();
    let hasIssues = false;

    // Check authorId
    if (article.authorId && !validUserIds.has(article.authorId)) {
      orphanedAuthorRefs++;
      if (sampleAuthorIds.length < 5) {
        sampleAuthorIds.push(article.authorId);
      }
      if (sampleArticleIds.length < 5) {
        sampleArticleIds.push(articleId);
      }
      hasIssues = true;
    }

    // Check required fields
    if (!article.title || !article.content || !article.authorId || !article.authorName) {
      missingRequiredFields++;
      if (missingFieldIds.length < 5) {
        missingFieldIds.push(articleId);
      }
      hasIssues = true;
    }
  }

  if (orphanedAuthorRefs > 0) {
    issues.push({
      collection: 'Article',
      issueType: 'orphaned_reference',
      description: 'Articles referencing non-existent authors',
      count: orphanedAuthorRefs,
      sampleIds: sampleArticleIds.slice(0, 5),
      category: 'CONDITIONAL_CLEANUP',
      field: 'authorId',
      details: { note: 'Requires manual review - may need to reassign author or delete article' }
    });
  }

  if (missingRequiredFields > 0) {
    issues.push({
      collection: 'Article',
      issueType: 'missing_required_field',
      description: 'Articles missing required fields (title, content, authorId, or authorName)',
      count: missingRequiredFields,
      sampleIds: missingFieldIds.slice(0, 5),
      category: 'DO_NOT_TOUCH',
      details: { note: 'Requires manual review - may be critical data' }
    });
  }

  return issues;
}

/**
 * Discover orphaned references in Reports
 */
export async function discoverReportIssues(): Promise<SanitizationIssue[]> {
  const issues: SanitizationIssue[] = [];
  const validUserIds = await getValidUserIds();
  const validArticleIds = await getValidArticleIds();

  const reports = await Report.find({}).lean();
  let orphanedReporterRefs = 0;
  let orphanedRespondentRefs = 0;
  let orphanedTargetRefs = 0;
  let orphanedActionedByRefs = 0;
  const sampleReportIds: string[] = [];
  const sampleReporterIds: string[] = [];
  const sampleRespondentIds: string[] = [];
  const sampleTargetIds: string[] = [];
  const sampleActionedByIds: string[] = [];

  for (const report of reports) {
    const reportId = report._id.toString();
    let hasIssues = false;

    // Check reporter
    if (report.reporter?.id && !validUserIds.has(report.reporter.id)) {
      orphanedReporterRefs++;
      if (sampleReporterIds.length < 5) {
        sampleReporterIds.push(report.reporter.id);
      }
      if (sampleReportIds.length < 5) {
        sampleReportIds.push(reportId);
      }
      hasIssues = true;
    }

    // Check respondent
    if (report.respondent?.id && !validUserIds.has(report.respondent.id)) {
      orphanedRespondentRefs++;
      if (sampleRespondentIds.length < 5) {
        sampleRespondentIds.push(report.respondent.id);
      }
      if (sampleReportIds.length < 5 && !sampleReportIds.includes(reportId)) {
        sampleReportIds.push(reportId);
      }
      hasIssues = true;
    }

    // Check targetId based on targetType
    if (report.targetType === 'nugget' && report.targetId && !validArticleIds.has(report.targetId)) {
      orphanedTargetRefs++;
      if (sampleTargetIds.length < 5) {
        sampleTargetIds.push(report.targetId);
      }
      if (sampleReportIds.length < 5 && !sampleReportIds.includes(reportId)) {
        sampleReportIds.push(reportId);
      }
      hasIssues = true;
    } else if (report.targetType === 'user' && report.targetId && !validUserIds.has(report.targetId)) {
      orphanedTargetRefs++;
      if (sampleTargetIds.length < 5) {
        sampleTargetIds.push(report.targetId);
      }
      if (sampleReportIds.length < 5 && !sampleReportIds.includes(reportId)) {
        sampleReportIds.push(reportId);
      }
      hasIssues = true;
    }

    // Check actionedBy
    if (report.actionedBy && !validUserIds.has(report.actionedBy)) {
      orphanedActionedByRefs++;
      if (sampleActionedByIds.length < 5) {
        sampleActionedByIds.push(report.actionedBy);
      }
      if (sampleReportIds.length < 5 && !sampleReportIds.includes(reportId)) {
        sampleReportIds.push(reportId);
      }
      hasIssues = true;
    }
  }

  if (orphanedReporterRefs > 0) {
    issues.push({
      collection: 'Report',
      issueType: 'orphaned_reference',
      description: 'Reports with non-existent reporter IDs',
      count: orphanedReporterRefs,
      sampleIds: sampleReportIds.slice(0, 5),
      category: 'CONDITIONAL_CLEANUP',
      field: 'reporter.id',
      details: { note: 'May need to preserve for audit trail' }
    });
  }

  if (orphanedRespondentRefs > 0) {
    issues.push({
      collection: 'Report',
      issueType: 'orphaned_reference',
      description: 'Reports with non-existent respondent IDs',
      count: orphanedRespondentRefs,
      sampleIds: sampleReportIds.slice(0, 5),
      category: 'CONDITIONAL_CLEANUP',
      field: 'respondent.id',
      details: { note: 'May need to preserve for audit trail' }
    });
  }

  if (orphanedTargetRefs > 0) {
    issues.push({
      collection: 'Report',
      issueType: 'orphaned_reference',
      description: 'Reports referencing non-existent targets',
      count: orphanedTargetRefs,
      sampleIds: sampleReportIds.slice(0, 5),
      category: 'CONDITIONAL_CLEANUP',
      field: 'targetId',
      details: { note: 'May need to preserve for audit trail' }
    });
  }

  if (orphanedActionedByRefs > 0) {
    issues.push({
      collection: 'Report',
      issueType: 'orphaned_reference',
      description: 'Reports with non-existent actionedBy admin IDs',
      count: orphanedActionedByRefs,
      sampleIds: sampleReportIds.slice(0, 5),
      category: 'CONDITIONAL_CLEANUP',
      field: 'actionedBy',
      details: { note: 'May need to preserve for audit trail' }
    });
  }

  return issues;
}

/**
 * Discover orphaned references in ModerationAuditLog
 */
export async function discoverModerationAuditLogIssues(): Promise<SanitizationIssue[]> {
  const issues: SanitizationIssue[] = [];
  const validUserIds = await getValidUserIds();
  const validReportIds = new Set(
    (await Report.find({}, '_id').lean()).map(r => r._id.toString())
  );

  const logs = await ModerationAuditLog.find({}).lean();
  let orphanedReportRefs = 0;
  let orphanedPerformerRefs = 0;
  const sampleLogIds: string[] = [];
  const sampleReportIds: string[] = [];
  const samplePerformerIds: string[] = [];

  for (const log of logs) {
    const logId = log._id.toString();
    let hasIssues = false;

    if (!validReportIds.has(log.reportId)) {
      orphanedReportRefs++;
      if (sampleReportIds.length < 5) {
        sampleReportIds.push(log.reportId);
      }
      if (sampleLogIds.length < 5) {
        sampleLogIds.push(logId);
      }
      hasIssues = true;
    }

    if (!validUserIds.has(log.performedBy)) {
      orphanedPerformerRefs++;
      if (samplePerformerIds.length < 5) {
        samplePerformerIds.push(log.performedBy);
      }
      if (sampleLogIds.length < 5 && !sampleLogIds.includes(logId)) {
        sampleLogIds.push(logId);
      }
      hasIssues = true;
    }
  }

  if (orphanedReportRefs > 0) {
    issues.push({
      collection: 'ModerationAuditLog',
      issueType: 'orphaned_reference',
      description: 'Audit logs referencing non-existent reports',
      count: orphanedReportRefs,
      sampleIds: sampleLogIds.slice(0, 5),
      category: 'CONDITIONAL_CLEANUP',
      field: 'reportId',
      details: { note: 'May need to preserve for audit trail' }
    });
  }

  if (orphanedPerformerRefs > 0) {
    issues.push({
      collection: 'ModerationAuditLog',
      issueType: 'orphaned_reference',
      description: 'Audit logs with non-existent performer IDs',
      count: orphanedPerformerRefs,
      sampleIds: sampleLogIds.slice(0, 5),
      category: 'CONDITIONAL_CLEANUP',
      field: 'performedBy',
      details: { note: 'May need to preserve for audit trail' }
    });
  }

  return issues;
}

/**
 * Discover orphaned references in Feedback
 */
export async function discoverFeedbackIssues(): Promise<SanitizationIssue[]> {
  const issues: SanitizationIssue[] = [];
  const validUserIds = await getValidUserIds();

  const feedbacks = await Feedback.find({}).lean();
  let orphanedUserRefs = 0;
  const sampleFeedbackIds: string[] = [];
  const sampleUserIds: string[] = [];

  for (const feedback of feedbacks) {
    if (feedback.user?.id && !validUserIds.has(feedback.user.id)) {
      orphanedUserRefs++;
      if (sampleUserIds.length < 5) {
        sampleUserIds.push(feedback.user.id);
      }
      if (sampleFeedbackIds.length < 5) {
        sampleFeedbackIds.push(feedback._id.toString());
      }
    }
  }

  if (orphanedUserRefs > 0) {
    issues.push({
      collection: 'Feedback',
      issueType: 'orphaned_reference',
      description: 'Feedback entries with non-existent user IDs',
      count: orphanedUserRefs,
      sampleIds: sampleFeedbackIds.slice(0, 5),
      category: 'CONDITIONAL_CLEANUP',
      field: 'user.id',
      details: { note: 'May need to preserve for historical context' }
    });
  }

  return issues;
}

/**
 * Run all discovery functions and return aggregated issues
 */
export async function discoverAllIssues(): Promise<SanitizationIssue[]> {
  console.log('[Discovery] Starting database audit...');
  
  const allIssues: SanitizationIssue[] = [];

  try {
    console.log('[Discovery] Scanning Collections...');
    allIssues.push(...await discoverCollectionIssues());
    
    console.log('[Discovery] Scanning Bookmarks...');
    allIssues.push(...await discoverBookmarkIssues());
    
    console.log('[Discovery] Scanning BookmarkFolders...');
    allIssues.push(...await discoverBookmarkFolderIssues());
    
    console.log('[Discovery] Scanning BookmarkFolderLinks...');
    allIssues.push(...await discoverBookmarkFolderLinkIssues());
    
    console.log('[Discovery] Scanning Articles...');
    allIssues.push(...await discoverArticleIssues());
    
    console.log('[Discovery] Scanning Reports...');
    allIssues.push(...await discoverReportIssues());
    
    console.log('[Discovery] Scanning ModerationAuditLog...');
    allIssues.push(...await discoverModerationAuditLogIssues());
    
    console.log('[Discovery] Scanning Feedback...');
    allIssues.push(...await discoverFeedbackIssues());
    
    console.log(`[Discovery] Audit complete. Found ${allIssues.length} issue types.`);
  } catch (error: any) {
    console.error('[Discovery] Error during audit:', error.message);
    throw error;
  }

  return allIssues;
}











