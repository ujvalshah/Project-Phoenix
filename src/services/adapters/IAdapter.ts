import { Article, User, Collection } from '@/types';

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
}

export interface IAdapter {
  // Articles
  getAllArticles(params?: { q?: string; page?: number; limit?: number }): Promise<Article[]>;
  getArticlesPaginated(params: { q?: string; page: number; limit: number; category?: string; sort?: string }): Promise<PaginatedArticlesResponse>;
  getArticleById(id: string): Promise<Article | undefined>;
  getArticlesByAuthor(authorId: string): Promise<Article[]>;
  getMyArticleCounts(): Promise<ArticleCountsResponse>;
  createArticle(article: Omit<Article, 'id' | 'publishedAt'>): Promise<Article>;
  updateArticle(id: string, updates: Partial<Article>): Promise<Article | null>;
  deleteArticle(id: string): Promise<boolean>;

  // Users
  getUsers(): Promise<User[]>;
  getUserById(id: string): Promise<User | undefined>;
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

  // Collections
  getCollections(params?: { type?: 'public' | 'private'; includeCount?: boolean }): Promise<Collection[] | { data: Collection[]; count: number }>;
  getCollectionById(id: string): Promise<Collection | undefined>;
  createCollection(name: string, description: string, creatorId: string, type: 'public' | 'private'): Promise<Collection>;
  deleteCollection(id: string): Promise<void>;
  updateCollection(id: string, updates: Partial<Collection>): Promise<Collection | null>;
  addArticleToCollection(collectionId: string, articleId: string, userId: string): Promise<void>;
  removeArticleFromCollection(collectionId: string, articleId: string, userId: string): Promise<void>;
  flagEntryAsIrrelevant(collectionId: string, articleId: string, userId: string): Promise<void>;
  followCollection(collectionId: string): Promise<void>;
  unfollowCollection(collectionId: string): Promise<void>;
}


