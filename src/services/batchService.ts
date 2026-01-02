/**
 * Batch Service - Fast & Boring Metadata Import
 * 
 * Handles bulk nugget creation from:
 * - Pasted links
 * - CSV files
 * - Excel files
 * 
 * NO AI features - just metadata fetching and article creation.
 */

import { BatchRow } from '@/types/batch';
import { storageService } from './storageService';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { detectProviderFromUrl } from '@/utils/urlUtils';
import { normalizeCategoryLabel } from '@/utils/formatters';
import { unfurlUrl } from './unfurlService';
import type { Article } from '@/types';
import type { NuggetMedia } from '@/types';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Constants for validation
const MAX_URLS_PER_BATCH = 100;
const MAX_URL_LENGTH = 2048;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Extract URLs from text (one per line, or from pasted blocks)
 * Handles URLs embedded in text, validates protocol, deduplicates
 */
function extractUrls(text: string): string[] {
  const lines = text.split('\n').filter(line => line.trim() !== '');
  const urlRegex = /https?:\/\/[^\s]+/gi;
  const urls: string[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // If line looks like a URL, use it directly
    if (trimmed.match(/^https?:\/\//i)) {
      urls.push(trimmed);
    } else {
      // Otherwise, extract URLs from the line
      const matches = trimmed.match(urlRegex);
      if (matches) {
        urls.push(...matches);
      }
    }
  }
  
  // Validate and deduplicate
  const validUrls: string[] = [];
  const seen = new Set<string>();
  
  for (const url of urls) {
    try {
      const parsed = new URL(url);
      
      // Only allow http and https
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        continue;
      }
      
      // Normalize URL (remove trailing slash, lowercase hostname)
      const normalized = `${parsed.protocol}//${parsed.hostname.toLowerCase()}${parsed.pathname.replace(/\/$/, '')}${parsed.search}${parsed.hash}`;
      
      if (!seen.has(normalized)) {
        seen.add(normalized);
        validUrls.push(url); // Keep original URL for display
      }
    } catch {
      // Invalid URL, skip
      continue;
    }
  }
  
  return validUrls;
}

/**
 * Transform Nugget metadata to Article format for preview
 */
function nuggetToArticle(
  url: string,
  nuggetMedia: NuggetMedia | null,
  currentUserId: string,
  authorName: string,
  customTitle?: string,
  customContent?: string,
  categories: string[] = []
): Article {
  // Title comes ONLY from user input (customTitle)
  const title = customTitle || undefined;
  
  const description = nuggetMedia?.previewMetadata?.description || '';
  const content = customContent || description || url;
  const excerpt = content.substring(0, 150) + (content.length > 150 ? '...' : '');
  
  // Calculate read time (200 words per minute)
  const wordCount = content.trim().split(/\s+/).length;
  const readTime = Math.max(1, Math.ceil(wordCount / 200));
  
  const previewTags = categories.filter((cat): cat is string => typeof cat === 'string' && cat.trim().length > 0);
  
  return {
    id: `preview-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    title,
    excerpt,
    content,
    author: {
      id: currentUserId,
      name: authorName,
    },
    publishedAt: new Date().toISOString(),
    categories,
    tags: previewTags,
    readTime,
    visibility: 'public',
    source_type: 'link',
    media: nuggetMedia,
  };
}

/**
 * Process URLs with concurrency limit
 */
async function processWithConcurrency<T>(
  items: T[],
  processor: (item: T) => Promise<void>,
  concurrency: number = 3
): Promise<void> {
  const executing = new Set<Promise<void>>();
  
  for (const item of items) {
    const promise = processor(item).finally(() => {
      executing.delete(promise);
    });
    
    executing.add(promise);
    
    if (executing.size >= concurrency) {
      await Promise.race(executing);
    }
  }
  
  await Promise.all(executing);
}

export const batchService = {
  // --- Generators ---
  generateId: () => Math.random().toString(36).substr(2, 9),

  // --- Parsers ---

  /**
   * Parse links from text input
   */
  async parseLinks(text: string): Promise<BatchRow[]> {
    if (!text || !text.trim()) {
      throw new Error('Input cannot be empty');
    }
    
    const urls = extractUrls(text);
    
    if (urls.length === 0) {
      throw new Error('No valid URLs found. Please check your input.');
    }
    
    if (urls.length > MAX_URLS_PER_BATCH) {
      throw new Error(`Maximum ${MAX_URLS_PER_BATCH} URLs allowed per batch. Found ${urls.length}.`);
    }
    
    const invalidUrls = urls.filter(url => url.length > MAX_URL_LENGTH);
    if (invalidUrls.length > 0) {
      throw new Error(`Some URLs exceed maximum length of ${MAX_URL_LENGTH} characters.`);
    }
    
    return urls.map(url => ({
      id: this.generateId(),
      url,
      title: '',
      content: '',
      categories: [],
      visibility: 'public',
      status: 'pending',
      selected: true,
      errorMessage: undefined,
      previewArticle: undefined,
    }));
  },

  async parseCSV(file: File): Promise<BatchRow[]> {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File size exceeds maximum of ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
    }
    
    return new Promise((resolve, reject) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const rows: BatchRow[] = results.data.map((row: any) => ({
            id: this.generateId(),
            url: row.url || '',
            title: row.title || '',
            content: row.text || row.content || row.notes || '',
            categories: row.categories ? row.categories.split(',').map((c: string) => c.trim()) : [],
            visibility: (row.visibility?.toLowerCase() === 'private') ? 'private' : 'public',
            status: 'ready',
            selected: true,
            errorMessage: undefined,
            previewArticle: undefined,
          }));
          
          const validRows = rows.filter(r => r.url);
          
          if (validRows.length === 0) {
            reject(new Error('No valid URLs found in CSV file.'));
            return;
          }
          
          if (validRows.length > MAX_URLS_PER_BATCH) {
            reject(new Error(`Maximum ${MAX_URLS_PER_BATCH} URLs allowed per batch. Found ${validRows.length}.`));
            return;
          }
          
          resolve(validRows);
        },
        error: (err) => reject(err)
      });
    });
  },

  async parseExcel(file: File): Promise<BatchRow[]> {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File size exceeds maximum of ${MAX_FILE_SIZE / (1024 * 1024)}MB`);
    }
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const json: any[] = XLSX.utils.sheet_to_json(sheet);

          const rows: BatchRow[] = json.map((row: any) => ({
            id: this.generateId(),
            url: row.url || '',
            title: row.title || '',
            content: row.text || row.content || row.notes || '',
            categories: row.categories ? row.categories.toString().split(',').map((c: string) => c.trim()) : [],
            visibility: (row.visibility?.toLowerCase() === 'private') ? 'private' : 'public',
            status: 'ready',
            selected: true,
            errorMessage: undefined,
            previewArticle: undefined,
          }));
          
          const validRows = rows.filter(r => r.url);
          
          if (validRows.length === 0) {
            reject(new Error('No valid URLs found in Excel file.'));
            return;
          }
          
          if (validRows.length > MAX_URLS_PER_BATCH) {
            reject(new Error(`Maximum ${MAX_URLS_PER_BATCH} URLs allowed per batch. Found ${validRows.length}.`));
            return;
          }
          
          resolve(validRows);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = (err) => reject(err);
      reader.readAsBinaryString(file);
    });
  },

  // --- Processing ---

  /**
   * Fetch metadata for rows using the unfurl service
   */
  async fetchMetadataForRows(
    rows: BatchRow[],
    currentUserId: string,
    authorName: string
  ): Promise<{ rows: BatchRow[]; errors: string[] }> {
    const rowsToFetch = rows.filter(
      row => row.url && row.status !== 'success' && row.status !== 'fetching'
    );
    
    if (rowsToFetch.length === 0) {
      return { rows, errors: [] };
    }
    
    // Mark as fetching
    const updatedRows = rows.map(row => {
      if (rowsToFetch.find(r => r.id === row.id)) {
        return { ...row, status: 'fetching' as const };
      }
      return row;
    });
    
    const errors: string[] = [];
    
    await processWithConcurrency(
      rowsToFetch,
      async (row) => {
        const index = updatedRows.findIndex(r => r.id === row.id);
        if (index === -1) return;
        
        try {
          const nuggetMedia = await unfurlUrl(row.url);
          
          const previewArticle = nuggetToArticle(
            row.url,
            nuggetMedia,
            currentUserId,
            authorName,
            row.title || undefined,
            row.content || undefined,
            row.categories
          );
          
          updatedRows[index] = {
            ...updatedRows[index],
            title: previewArticle.title,
            content: row.content || previewArticle.content,
            status: 'ready' as const,
            previewArticle,
            errorMessage: undefined,
          };
        } catch (error: any) {
          const errorMsg = error?.message || 'Failed to fetch metadata';
          errors.push(`${row.url}: ${errorMsg}`);
          
          let siteName = 'unknown';
          try {
            siteName = new URL(row.url).hostname.replace('www.', '');
          } catch {
            // URL parsing failed
          }
          
          const fallbackMedia: NuggetMedia = {
            type: 'link',
            url: row.url,
            previewMetadata: {
              url: row.url,
              title: row.title || 'Content Preview',
              siteName,
            },
          };
          
          const fallbackArticle = nuggetToArticle(
            row.url,
            fallbackMedia,
            currentUserId,
            authorName,
            row.title,
            row.content,
            row.categories
          );
          
          updatedRows[index] = {
            ...updatedRows[index],
            title: fallbackArticle.title,
            content: row.content || fallbackArticle.content,
            status: 'ready' as const,
            previewArticle: fallbackArticle,
            errorMessage: errorMsg,
          };
        }
      },
      3
    );
    
    return { rows: updatedRows, errors };
  },

  /**
   * Create articles from batch rows
   */
  async createBatch(
    rows: BatchRow[],
    currentUserId: string,
    authorName: string,
    onProgress?: (current: number, total: number) => void
  ): Promise<BatchRow[]> {
    const results = [...rows];
    const rowsToCreate = results.filter(r => r.selected && r.status === 'ready');
    let completed = 0;

    for (const row of rowsToCreate) {
      try {
        const articleData = row.previewArticle || nuggetToArticle(
          row.url,
          null,
          currentUserId,
          authorName,
          row.title,
          row.content,
          row.categories
        );
        
        const resolvedTitle = row.title && row.title.trim() ? row.title : undefined;
        const batchTags = row.categories.map(c => normalizeCategoryLabel(c).replace('#', '')).filter(Boolean);
        
        const createdArticle = await storageService.createArticle({
          title: resolvedTitle,
          content: row.content || articleData.content,
          excerpt: articleData.excerpt,
          author: { id: currentUserId, name: authorName },
          categories: batchTags,
          tags: batchTags,
          readTime: articleData.readTime,
          visibility: row.visibility || 'public',
          source_type: 'link',
          media: (() => {
            if (articleData.media) {
              return articleData.media;
            }
            const detectedType = detectProviderFromUrl(row.url);
            const fallbackMedia: any = {
              type: detectedType,
              url: row.url,
              previewMetadata: {
                url: row.url,
                title: resolvedTitle,
                providerName: new URL(row.url).hostname,
              },
            };
            
            // Set aspect ratio for video providers
            if (detectedType === 'youtube') {
              fallbackMedia.aspect_ratio = '16/9';
            }
            
            return fallbackMedia;
          })(),
        });

        row.articleId = createdArticle.id;
        row.status = 'success';
        completed++;
        
        if (onProgress) {
          onProgress(completed, rowsToCreate.length);
        }
        
        await delay(100);
      } catch (e: any) {
        row.status = 'error';
        const errorMsg = e?.message || 'Creation failed';
        row.errorMessage = errorMsg;
        console.error(`Failed to create nugget for ${row.url}:`, errorMsg, e);
        completed++;
        
        if (onProgress) {
          onProgress(completed, rowsToCreate.length);
        }
      }
    }

    return results;
  },

  /**
   * Publish multiple draft nuggets by setting their visibility to 'public'
   */
  async publishNuggets(ids: string[]): Promise<{ success: boolean; message: string; updatedCount: number }> {
    if (!ids || ids.length === 0) {
      throw new Error('Array of nugget IDs is required');
    }

    const API_BASE = import.meta.env.VITE_API_URL || '/api';
    
    // Extract token from localStorage (stored as JSON object)
    let token = '';
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        const stored = localStorage.getItem('nuggets_auth_data_v2');
        if (stored) {
          const parsed = JSON.parse(stored);
          token = parsed.token || '';
        }
      }
    } catch (e) {
      console.warn('[BatchService] Failed to parse auth token from storage', e);
    }
    
    const authHeader = token ? { Authorization: `Bearer ${token}` } : {};

    const response = await fetch(`${API_BASE}/batch/publish`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeader,
      },
      body: JSON.stringify({ ids }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: 'Failed to publish nuggets' }));
      throw new Error(errorData.message || `HTTP ${response.status}`);
    }

    return await response.json();
  }
};
