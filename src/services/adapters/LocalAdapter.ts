import { Article, User, Collection, CollectionEntry } from '@/types';
import { ARTICLES as INITIAL_DATA } from '@/data/articles';
import { IAdapter } from './IAdapter';

const STORAGE_KEY = 'newsbytes_articles_db';
const USERS_KEY = 'newsbytes_users_db';
const CATEGORIES_KEY = 'newsbytes_categories_db';
const COLLECTIONS_KEY = 'newsbytes_collections_db';

const INITIAL_CATEGORIES = [
  'Finance', 'Tech', 'Design', 'Politics', 'Environment', 
  'Health', 'Culture', 'Science', 'Lifestyle', 'Business', 'Growth'
];

const INITIAL_USERS: User[] = [
  {
    id: 'u1',
    name: 'Akash Solanki',
    email: 'akash@example.com',
    role: 'admin',
    status: 'active',
    joinedAt: '2025-01-15T10:00:00Z',
    preferences: {
        interestedCategories: ['Tech', 'Business', 'Finance']
    },
    lastFeedVisit: new Date(Date.now() - 86400000 * 2).toISOString() 
  },
  {
    id: 'u2',
    name: 'Hemant Sharma',
    email: 'hemant@example.com',
    role: 'user',
    status: 'active',
    joinedAt: '2025-02-20T14:30:00Z',
    preferences: {
        interestedCategories: ['Design', 'Lifestyle']
    },
    lastFeedVisit: new Date().toISOString()
  }
];

const INITIAL_COLLECTIONS: Collection[] = [
  {
    id: 'col_general_bookmarks_u1',
    name: 'General Bookmarks',
    description: 'Auto-saved bookmarks.',
    creatorId: 'u1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    followersCount: 0,
    entries: [],
    type: 'private'
  },
  {
    id: 'col_read_later',
    name: 'Read Later',
    description: 'Articles saved for later reading.',
    creatorId: 'u1',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    followersCount: 0,
    entries: [],
    type: 'private'
  },
  {
    id: 'col_india_growth',
    name: 'The India Growth Story',
    description: 'A curated list of nuggets tracking India\'s economic rise.',
    creatorId: 'u1',
    createdAt: '2025-10-01T10:00:00Z',
    updatedAt: '2025-10-02T11:30:00Z',
    followersCount: 15420,
    entries: [
        { articleId: '1', addedByUserId: 'u1', addedAt: '2025-10-01T10:00:00Z', flaggedBy: [] },
        { articleId: '4', addedByUserId: 'u2', addedAt: '2025-10-02T11:30:00Z', flaggedBy: [] },
    ],
    type: 'public'
  }
];

export class LocalAdapter implements IAdapter {
  private storageInitialized = false;

  constructor() {
    // Don't initialize storage in constructor - do it lazily when needed
  }

  private initStorage() {
    if (this.storageInitialized) return;
    
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        if (!localStorage.getItem(STORAGE_KEY)) {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(INITIAL_DATA));
        }
        if (!localStorage.getItem(USERS_KEY)) {
          localStorage.setItem(USERS_KEY, JSON.stringify(INITIAL_USERS));
        }
        if (!localStorage.getItem(CATEGORIES_KEY)) {
          localStorage.setItem(CATEGORIES_KEY, JSON.stringify(INITIAL_CATEGORIES));
        }
        if (!localStorage.getItem(COLLECTIONS_KEY)) {
          localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(INITIAL_COLLECTIONS));
        }
        this.storageInitialized = true;
      }
    } catch (e) {
      console.warn('Storage initialization failed:', e);
    }
  }

  async getAllArticles(params?: { q?: string; page?: number; limit?: number }): Promise<Article[]> {
    this.initStorage();
    try {
      const data = localStorage.getItem(STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.warn('Failed to get articles from storage:', e);
      return [];
    }
  }

  async getArticlesPaginated(): Promise<import('./IAdapter').PaginatedArticlesResponse> {
    throw new Error('Pagination not supported by LocalAdapter. Use RestAdapter for paginated queries.');
  }

  async getArticleById(id: string): Promise<Article | undefined> {
    const articles = await this.getAllArticles();
    return articles.find(a => a.id === id);
  }

  async getArticlesByAuthor(authorId: string): Promise<Article[]> {
    const articles = await this.getAllArticles();
    return articles.filter(a => a.author.id === authorId);
  }

  async getMyArticleCounts(): Promise<import('./IAdapter').ArticleCountsResponse> {
    // For LocalAdapter, get current user ID from localStorage or return mock data
    // This is a simplified implementation since LocalAdapter doesn't have authentication
    const articles = await this.getAllArticles();
    // Since we don't have auth context in LocalAdapter, return counts for all articles
    // In practice, LocalAdapter is mainly for development/testing
    const total = articles.length;
    const publicCount = articles.filter(a => (a.visibility ?? 'public') === 'public').length;
    const privateCount = articles.filter(a => a.visibility === 'private').length;
    
    return {
      total,
      public: publicCount,
      private: privateCount
    };
  }

  async createArticle(article: Omit<Article, 'id' | 'publishedAt'>): Promise<Article> {
    this.initStorage();
    const articles = await this.getAllArticles();
    const newArticle: Article = {
      ...article,
      id: Date.now().toString(),
      publishedAt: new Date().toISOString(),
      readTime: article.readTime || 5,
      images: article.images || [],
      categories: article.categories || [],
      tags: article.tags || [],
      visibility: article.visibility || 'public',
      displayAuthor: article.displayAuthor
    };
    const updated = [newArticle, ...articles];
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to save article to storage:', e);
      throw e;
    }
    return newArticle;
  }

  async updateArticle(id: string, updates: Partial<Article>): Promise<Article | null> {
    this.initStorage();
    const articles = await this.getAllArticles();
    const index = articles.findIndex(a => a.id === id);
    if (index === -1) return null;
    const updatedArticle = { ...articles[index], ...updates };
    articles[index] = updatedArticle;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(articles));
    } catch (e) {
      console.warn('Failed to update article in storage:', e);
      throw e;
    }
    return updatedArticle;
  }

  async deleteArticle(id: string): Promise<boolean> {
    this.initStorage();
    const articles = await this.getAllArticles();
    const filtered = articles.filter(a => a.id !== id);
    if (articles.length === filtered.length) return false;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    } catch (e) {
      console.warn('Failed to delete article from storage:', e);
      throw e;
    }
    return true;
  }

  async getUsers(): Promise<User[]> {
    this.initStorage();
    try {
      const data = localStorage.getItem(USERS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.warn('Failed to get users from storage:', e);
      return [];
    }
  }

  async getUserById(id: string): Promise<User | undefined> {
    const users = await this.getUsers();
    let user = users.find(u => u.id === id);
    if (!user) {
      user = {
        id: id,
        name: "Unknown User",
        email: "unknown@nuggets.app",
        role: "user",
        status: "active",
        joinedAt: new Date().toISOString()
      };
    }
    return user;
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | null> {
    this.initStorage();
    const users = await this.getUsers();
    const index = users.findIndex(u => u.id === id);
    if (index === -1) return null;
    const updatedUser = { ...users[index], ...updates };
    users[index] = updatedUser;
    try {
      localStorage.setItem(USERS_KEY, JSON.stringify(users));
    } catch (e) {
      console.warn('Failed to update user in storage:', e);
      throw e;
    }
    return updatedUser;
  }

  async deleteUser(id: string): Promise<void> {
    this.initStorage();
    const users = await this.getUsers();
    const updated = users.filter(u => u.id !== id);
    try {
      localStorage.setItem(USERS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to delete user from storage:', e);
      throw e;
    }
  }

  async updateUserPreferences(userId: string, interestedCategories: string[]): Promise<void> {
    await this.updateUser(userId, { preferences: { interestedCategories } });
  }

  async updateLastFeedVisit(userId: string): Promise<void> {
    await this.updateUser(userId, { lastFeedVisit: new Date().toISOString() });
  }

  async getPersonalizedFeed(userId: string): Promise<{ articles: Article[], newCount: number }> {
    const articles = await this.getAllArticles();
    const user = await this.getUserById(userId);
    if (!user) return { articles: [], newCount: 0 };
    const interests = user.preferences?.interestedCategories || [];
    const lastVisit = user.lastFeedVisit ? new Date(user.lastFeedVisit).getTime() : 0;
    let filtered = interests.length === 0 
      ? articles 
      : articles.filter(a => a.categories.some(c => interests.includes(c)));
    filtered.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
    const newCount = filtered.reduce((acc, a) => new Date(a.publishedAt).getTime() > lastVisit ? acc + 1 : acc, 0);
    return { articles: filtered, newCount };
  }

  async getCategories(): Promise<string[]> {
    this.initStorage();
    try {
      const data = localStorage.getItem(CATEGORIES_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.warn('Failed to get categories from storage:', e);
      return [];
    }
  }

  async addCategory(category: string): Promise<void> {
    const categories = await this.getCategories();
    if (!categories.includes(category)) {
      const updated = [...categories, category].sort();
      localStorage.setItem(CATEGORIES_KEY, JSON.stringify(updated));
    }
  }

  async deleteCategory(category: string): Promise<void> {
    this.initStorage();
    const categories = await this.getCategories();
    const updated = categories.filter(c => c !== category);
    try {
      localStorage.setItem(CATEGORIES_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to delete category from storage:', e);
      throw e;
    }
  }

  async getCollections(params?: { type?: 'public' | 'private'; includeCount?: boolean }): Promise<Collection[] | { data: Collection[]; count: number }> {
    this.initStorage();
    try {
      const data = localStorage.getItem(COLLECTIONS_KEY);
      const parsed: Collection[] = data ? JSON.parse(data) : [];
      let collections = parsed.map(c => ({ 
          ...c, 
          entries: c.entries || [],
          type: c.type || 'public',
          updatedAt: c.updatedAt || c.createdAt
      }));
      
      // Apply type filter if specified
      if (params?.type) {
        collections = collections.filter(c => c.type === params.type);
      }
      
      // Return with count if requested
      if (params?.includeCount) {
        return {
          data: collections,
          count: collections.length
        };
      }
      
      return collections;
    } catch (e) {
      console.warn('Failed to get collections from storage:', e);
      return params?.includeCount ? { data: [], count: 0 } : [];
    }
  }

  async getCollectionById(id: string): Promise<Collection | undefined> {
    const collections = await this.getCollections();
    return collections.find(c => c.id === id);
  }

  async createCollection(name: string, description: string, creatorId: string, type: 'public' | 'private' = 'public'): Promise<Collection> {
    const collections = await this.getCollections();
    const now = new Date().toISOString();
    const newCollection: Collection = {
      id: Date.now().toString(),
      name,
      description,
      creatorId,
      createdAt: now,
      updatedAt: now,
      followersCount: 0,
      entries: [],
      type
    };
    const updated = [newCollection, ...collections];
    localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(updated));
    return newCollection;
  }

  async deleteCollection(id: string): Promise<void> {
    this.initStorage();
    const collections = await this.getCollections();
    const updated = collections.filter(c => c.id !== id);
    try {
      localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to delete collection from storage:', e);
      throw e;
    }
  }

  async updateCollection(id: string, updates: Partial<Collection>): Promise<Collection | null> {
    this.initStorage();
    const collections = await this.getCollections();
    const index = collections.findIndex(c => c.id === id);
    if (index === -1) return null;
    const updated = { ...collections[index], ...updates, updatedAt: new Date().toISOString() };
    collections[index] = updated;
    try {
      localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(collections));
    } catch (e) {
      console.warn('Failed to update collection in storage:', e);
      throw e;
    }
    return updated;
  }

  async addArticleToCollection(collectionId: string, articleId: string, userId: string): Promise<void> {
    this.initStorage();
    const collections = await this.getCollections();
    const index = collections.findIndex(c => c.id === collectionId);
    if (index === -1) return;
    const existingEntry = collections[index].entries.find(e => e.articleId === articleId);
    if (existingEntry) return;
    const newEntry: CollectionEntry = {
      articleId,
      addedByUserId: userId,
      addedAt: new Date().toISOString(),
      flaggedBy: []
    };
    collections[index].entries.push(newEntry);
    collections[index].updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(collections));
    } catch (e) {
      console.warn('Failed to add article to collection in storage:', e);
      throw e;
    }
  }

  async removeArticleFromCollection(collectionId: string, articleId: string, userId: string): Promise<void> {
    this.initStorage();
    const collections = await this.getCollections();
    const index = collections.findIndex(c => c.id === collectionId);
    if (index === -1) return;
    collections[index].entries = collections[index].entries.filter(e => e.articleId !== articleId);
    collections[index].updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(collections));
    } catch (e) {
      console.warn('Failed to remove article from collection in storage:', e);
      throw e;
    }
  }

  async flagEntryAsIrrelevant(collectionId: string, articleId: string, userId: string): Promise<void> {
    this.initStorage();
    const collections = await this.getCollections();
    const cIndex = collections.findIndex(c => c.id === collectionId);
    if (cIndex === -1) return;
    const entryIndex = collections[cIndex].entries.findIndex(e => e.articleId === articleId);
    if (entryIndex === -1) return;
    const entry = collections[cIndex].entries[entryIndex];
    if (!entry.flaggedBy) entry.flaggedBy = [];
    if (!entry.flaggedBy.includes(userId)) {
      entry.flaggedBy.push(userId);
    } else {
      entry.flaggedBy = entry.flaggedBy.filter(id => id !== userId);
    }
    collections[cIndex].entries[entryIndex] = entry;
    try {
      localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(collections));
    } catch (e) {
      console.warn('Failed to flag entry in storage:', e);
      throw e;
    }
  }
}


