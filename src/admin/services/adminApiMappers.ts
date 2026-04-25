/**
 * Mappers to transform backend API responses to Admin types
 */

import { User } from '@/types/user';
import { Article } from '@/types';
import { Collection } from '@/types';
import { AdminUser, AdminNugget, AdminCollection, AdminTag, AdminReport, AdminFeedback, AdminContactMessage } from '../types/admin';

/**
 * Map backend User (modular) to AdminUser
 */
export function mapUserToAdminUser(user: User, stats?: {
  nuggets: number;
  nuggetsPublic: number;
  nuggetsPrivate: number;
  collections: number;
  collectionsFollowing: number;
  reports: number;
}): AdminUser {
  return {
    id: user.id,
    name: user.profile.displayName,
    fullName: user.profile.displayName, // Backend doesn't have separate fullName
    username: user.profile.username,
    searchCohort: user.appState.searchCohort,
    email: user.auth.email,
    emailVerified: user.auth.emailVerified ?? false,
    authProvider: user.auth.provider ?? 'email',
    role: user.role === 'admin' ? 'admin' : 'user',
    // PR10 / PR7b — User.status is now real. Legacy docs without the field
    // (written before the migration) read back as undefined; treat those as
    // active so the table doesn't render an empty badge.
    status: user.status ?? 'active',
    avatarUrl: user.profile.avatarUrl,
    joinedAt: user.auth.createdAt,
    lastLoginAt: user.appState.lastLoginAt,
    stats: stats || {
      nuggets: 0,
      nuggetsPublic: 0,
      nuggetsPrivate: 0,
      collections: 0,
      collectionsFollowing: 0,
      reports: 0
    }
  };
}

/**
 * Map backend Article to AdminNugget
 */
export function mapArticleToAdminNugget(article: Article, reportsCount: number = 0): AdminNugget {
  // Validate article is not null/undefined
  if (!article || typeof article !== 'object') {
    throw new Error('mapArticleToAdminNugget: article is null, undefined, or not an object');
  }
  
  // Validate required fields
  if (!article.id) {
    throw new Error('mapArticleToAdminNugget: article.id is missing or invalid');
  }
  
  // Handle author data - backend should always provide author, but handle missing gracefully
  // Backend transformArticle always creates author object, but check for safety
  let authorId = 'unknown';
  let authorName = 'Unknown Author';
  let authorAvatar: string | undefined = undefined;
  
  if (article.author && typeof article.author === 'object') {
    authorId = article.author.id || 'unknown';
    authorName = article.author.name || 'Unknown Author';
    authorAvatar = article.author.avatar_url;
  } else {
    // Fallback: try to get authorId/authorName from article directly (backend stores these separately)
    // This handles edge cases where author object might not be properly set
    const anyArticle = article as any;
    if (anyArticle.authorId) authorId = anyArticle.authorId;
    if (anyArticle.authorName) authorName = anyArticle.authorName;
    
    // Log warning only in development and only when author is truly missing
    // This prevents spam but alerts developers to data issues
    if (process.env.NODE_ENV === 'development' && !anyArticle.authorId && !anyArticle.authorName) {
      console.warn('mapArticleToAdminNugget: article.author is missing or invalid, using defaults', { articleId: article.id });
    }
  }
  
  // Determine type from source_type or media
  let type: 'link' | 'text' | 'video' | 'image' | 'idea' = 'text';
  if (article.source_type) {
    if (article.source_type === 'link') type = 'link';
    else if (article.source_type === 'video') type = 'video';
    else if (article.source_type === 'idea') type = 'idea';
  }
  if (article.media?.type === 'image') type = 'image';
  if (article.media?.type === 'video' || article.video) type = 'video';
  const isYoutube = article.media?.type === 'youtube' || article.primaryMedia?.type === 'youtube';
  const sourceUrl =
    article.primaryMedia?.url ||
    article.media?.url ||
    article.video ||
    article.externalLinks?.find((link) => link.isPrimary)?.url ||
    article.externalLinks?.[0]?.url ||
    article.media?.previewMetadata?.url ||
    article.media?.previewMetadata?.finalUrl;
  const thumbnailUrl =
    article.primaryMedia?.thumbnail ||
    article.primaryMedia?.previewMetadata?.imageUrl ||
    article.primaryMedia?.url ||
    article.media?.thumbnail_url ||
    article.media?.previewMetadata?.imageUrl ||
    article.media?.url ||
    article.images?.[0] ||
    article.supportingMedia?.[0]?.thumbnail ||
    article.supportingMedia?.[0]?.url;

  return {
    id: article.id,
    title: article.title || '',
    excerpt: article.excerpt || (article.content ? article.content.substring(0, 150) : ''),
    author: {
      id: authorId,
      name: authorName,
      email: '', // Backend doesn't return email in article
      avatar: authorAvatar
    },
    type,
    url: sourceUrl,
    visibility: article.visibility || 'public',
    status: reportsCount > 0 ? 'flagged' : 'active', // Simplified: flagged if has reports
    createdAt: article.publishedAt || new Date().toISOString(),
    reports: reportsCount,
    tags: article.tags || [],
    sourceType: article.source_type,
    isYoutube,
    sourceUrl,
    thumbnailUrl,
  };
}

/**
 * Map backend Collection to AdminCollection
 */
export function mapCollectionToAdminCollection(collection: Collection): AdminCollection {
  return {
    id: collection.id,
    name: collection.name,
    description: collection.description,
    creator: {
      id: collection.creatorId,
      name: '' // Will need to fetch user name separately if needed
    },
    type: collection.type,
    itemCount: collection.validEntriesCount ?? collection.entries?.length ?? 0,
    followerCount: collection.followersCount || 0,
    status: 'active', // Backend doesn't have status field
    createdAt: collection.createdAt,
    updatedAt: collection.updatedAt || collection.createdAt,
    isFeatured: collection.isFeatured ?? false,
    featuredOrder: collection.featuredOrder ?? 0,
    parentId: collection.parentId ?? null,
  };
}

export interface RawTag {
  id: string;
  name?: string; // Legacy field
  rawName?: string; // Preferred field (exact user-entered text)
  canonicalName?: string; // Normalized lowercase version
  usageCount?: number;
  type?: 'category' | 'tag';
  isOfficial?: boolean;
  status?: 'active' | 'deprecated' | 'pending';
  requestedBy?: string;
}

export interface RawReport {
  id: string;
  targetId: string;
  targetType: 'nugget' | 'user' | 'collection';
  reason: 'spam' | 'harassment' | 'misinformation' | 'copyright' | 'other';
  description?: string;
  reporter: { id: string; name: string };
  respondent?: { id: string; name: string };
  status: 'open' | 'resolved' | 'dismissed';
  createdAt: string;
}

export interface RawFeedback {
  id: string;
  user?: {
    id: string;
    name: string;
    fullName?: string;
    username?: string;
    avatar?: string;
  };
  type: 'bug' | 'feature' | 'general';
  content: string;
  status: 'new' | 'read' | 'archived';
  createdAt: string;
}

/**
 * Map backend Tag to AdminTag
 */
export function mapTagToAdminTag(tag: RawTag): AdminTag {
  return {
    id: tag.id,
    name: tag.rawName || tag.name || '', // Prefer rawName (exact user-entered text)
    usageCount: tag.usageCount || 0,
    type: 'tag', // All tags are treated as 'tag' type
    isOfficial: tag.isOfficial || false,
    status: tag.status || 'active',
    requestedBy: tag.requestedBy
  };
}

/**
 * Map backend Report to AdminReport (already compatible)
 */
export function mapReportToAdminReport(report: RawReport): AdminReport {
  return {
    id: report.id,
    targetId: report.targetId,
    targetType: report.targetType,
    reason: report.reason,
    description: report.description,
    reporter: report.reporter,
    respondent: report.respondent || {
      id: '',
      name: ''
    },
    status: report.status,
    createdAt: report.createdAt
  };
}

/**
 * Map backend Feedback to AdminFeedback (already compatible)
 */
export function mapFeedbackToAdminFeedback(feedback: RawFeedback): AdminFeedback {
  return {
    id: feedback.id,
    user: feedback.user,
    type: feedback.type,
    content: feedback.content,
    status: feedback.status,
    createdAt: feedback.createdAt
  };
}

export interface RawContactMessage {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  status: 'new' | 'read' | 'replied' | 'archived';
  createdAt: string;
}

export function mapContactToAdminContact(contact: RawContactMessage): AdminContactMessage {
  return {
    id: contact.id,
    name: contact.name,
    email: contact.email,
    subject: contact.subject,
    message: contact.message,
    status: contact.status,
    createdAt: contact.createdAt
  };
}










