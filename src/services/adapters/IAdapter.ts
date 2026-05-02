import { Article, User, Collection, TagTaxonomy } from '@/types';
import type { PublicUserView } from '@/types/user';

export interface PaginatedArticlesResponse {
  data: Article[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ArticleCountsResponse {
  total: number;
  public: number;
  private: number;
  draft?: number;
  published?: number;
}

export interface IAdapter {
  // Articles
  getAllArticles(params?: { q?: string; page?: number; limit?: number }): Promise<Article[]>;
  getArticlesPaginated(params: {
    q?: string;
    searchMode?: 'relevance' | 'latest' | 'hybrid';
    page: number;
    limit: number;
    category?: string;
    categories?: string[];
    tag?: string;
    sort?: string;
    collectionId?: string;
    favorites?: boolean;
    unread?: boolean;
    formats?: string[];
    timeRange?: string;
    youtubeOnly?: boolean;
    nonYoutubeOnly?: boolean;
    formatTagIds?: string[];
    domainTagIds?: string[];
    subtopicTagIds?: string[];
    contentStream?: string;
    visibility?: 'public' | 'private';
    status?: 'draft' | 'published';
  }): Promise<PaginatedArticlesResponse>;
  getArticleById(id: string): Promise<Article | undefined>;
  getArticlesByAuthor(authorId: string): Promise<Article[]>;
  getMyArticleCounts(): Promise<ArticleCountsResponse>;
  createArticle(article: Omit<Article, 'id' | 'publishedAt'>): Promise<Article>;
  updateArticle(id: string, updates: Partial<Article>): Promise<Article | null>;
  deleteArticle(id: string): Promise<boolean>;

  /** Home + Market Pulse unseen counts for feed chrome badges */
  getUnseenFeedCounts(): Promise<{ home: number; marketPulse: number }>;
  /** Mark home or pulse feed visited (badge reset) */
  markFeedSeen(feed: 'home' | 'market-pulse'): Promise<void>;

  // Users
  getUsers(): Promise<User[]>;
  getUserById(id: string): Promise<PublicUserView | undefined>;
  updateUser(id: string, updates: Partial<User>): Promise<User | null>;
  deleteUser(id: string): Promise<void>;

  // Personalization
  updateUserPreferences(userId: string, interestedCategories: string[]): Promise<void>;
  updateLastFeedVisit(userId: string): Promise<void>;
  getPersonalizedFeed(userId: string): Promise<{ articles: Article[], newCount: number }>;

  // Categories
  getCategories(): Promise<string[]>;
  getCategoriesWithIds?(): Promise<import('@/types').Tag[]>; // Phase 2: Returns full Tag objects with IDs
  addCategory(category: string): Promise<void>;
  deleteCategory(category: string): Promise<void>;

  // Tag Taxonomy (three-axis: format + domain + subtopic)
  getTagTaxonomy(): Promise<TagTaxonomy>;

  // Collections
  getCollections(params?: {
    type?: 'public' | 'private';
    includeCount?: boolean;
    includeEntries?: boolean;
    summary?: boolean;
    searchQuery?: string;
    sortField?: 'created' | 'updated' | 'followers' | 'nuggets' | 'name';
    sortDirection?: 'asc' | 'desc';
    creatorId?: string;
    page?: number;
    limit?: number;
    parentId?: string;
    rootOnly?: boolean;
  }): Promise<Collection[] | { data: Collection[]; count: number }>;
  getFeaturedCollections(): Promise<Collection[]>;
  getCollectionArticles(collectionId: string, params: { q?: string; page: number; limit: number; sort?: string }): Promise<PaginatedArticlesResponse>;
  getCollectionById(id: string, options?: { includeEntries?: boolean }): Promise<Collection | undefined>;
  /** Editorial collections that include this article (author or admin only). */
  getCollectionsContainingArticle(articleId: string): Promise<Collection[]>;
  createCollection(name: string, description: string, creatorId: string, type: 'public' | 'private', parentId?: string | null): Promise<Collection>;
  deleteCollection(id: string): Promise<void>;
  updateCollection(id: string, updates: Partial<Collection>): Promise<Collection | null>;
  addArticleToCollection(collectionId: string, articleId: string, userId: string): Promise<void>;
  removeArticleFromCollection(collectionId: string, articleId: string, userId: string): Promise<void>;
  addBatchEntriesToCollection(collectionId: string, articleIds: string[], userId: string): Promise<void>;
  removeBatchEntriesFromCollection(collectionId: string, articleIds: string[], userId: string): Promise<void>;
  flagEntryAsIrrelevant(collectionId: string, articleId: string, userId: string): Promise<void>;
  followCollection(collectionId: string): Promise<void>;
  unfollowCollection(collectionId: string): Promise<void>;
}


