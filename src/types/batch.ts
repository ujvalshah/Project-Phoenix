import type { Article } from './index';

/**
 * BatchRow - Represents a single item in the batch import queue
 * 
 * This is for the "Fast & Boring" metadata import tool.
 * For AI-powered analysis, use the separate YouTube Analysis page.
 */
export interface BatchRow {
  id: string;
  url: string;
  title: string;
  content: string;
  categories: string[];
  visibility: 'public' | 'private';
  status: 'pending' | 'fetching' | 'ready' | 'success' | 'error';
  errorMessage?: string;
  selected?: boolean;
  previewArticle?: Article;
  articleId?: string;
}

export type ImportMode = 'links' | 'csv' | 'excel';
