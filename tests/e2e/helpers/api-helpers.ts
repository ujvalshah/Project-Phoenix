/**
 * API Helpers for E2E Tests
 *
 * Direct API calls for test setup and verification
 */

import type { Article } from '@/types';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const API_BASE = process.env.PLAYWRIGHT_API_BASE || 'http://localhost:5000/api';

// ES module compatible __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const AUTH_FILE = path.join(__dirname, '..', '.auth-state.json');

// In-memory cache for the current process
let cachedToken: string | null = null;

/**
 * Get authentication token from global setup
 * Returns empty string if not authenticated (tests will skip auth-required operations)
 */
export async function getAuthToken(_email?: string, _password?: string): Promise<string> {
  // Return cached token if available
  if (cachedToken !== null) {
    return cachedToken;
  }

  try {
    // Read from global setup's auth file
    if (fs.existsSync(AUTH_FILE)) {
      const authState = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));
      cachedToken = authState.token || '';
      return cachedToken;
    }
  } catch (error) {
    console.warn(`[getAuthToken] Error reading auth state:`, error);
  }

  // Fallback: try to authenticate directly (with rate limit handling)
  const email = _email || process.env.TEST_USER_EMAIL || 'test@example.com';
  const password = _password || process.env.TEST_USER_PASSWORD || 'testpassword123';

  try {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      console.warn(`[getAuthToken] Failed to login: ${response.status} ${response.statusText}`);
      cachedToken = '';
      return '';
    }

    const data = await response.json();
    cachedToken = data.token || '';
    return cachedToken;
  } catch (error) {
    console.warn(`[getAuthToken] Login error:`, error);
    cachedToken = '';
    return '';
  }
}

/**
 * Create an article via API
 */
export async function apiCreateArticle(
  articleData: Partial<Article>,
  token: string
): Promise<Article> {
  const response = await fetch(`${API_BASE}/articles`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(articleData),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(`Failed to create article: ${error.message || response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch an article by ID
 */
export async function apiFetchArticle(articleId: string, token?: string): Promise<Article> {
  const headers: HeadersInit = { 'Content-Type': 'application/json' };
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}/articles/${articleId}`, {
    method: 'GET',
    headers,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch article: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Delete an image from an article via API
 */
export async function apiDeleteImage(
  articleId: string,
  imageUrl: string,
  token: string
): Promise<{ success: boolean; message: string; images: string[] }> {
  const response = await fetch(`${API_BASE}/articles/${articleId}/images`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ imageUrl }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(`Failed to delete image: ${error.message || response.statusText}`);
  }

  return response.json();
}

/**
 * Update an article via API
 */
export async function apiUpdateArticle(
  articleId: string,
  updates: Partial<Article>,
  token: string
): Promise<Article> {
  const response = await fetch(`${API_BASE}/articles/${articleId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(updates),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'Unknown error' }));
    throw new Error(`Failed to update article: ${error.message || response.statusText}`);
  }

  return response.json();
}

/**
 * Delete an article via API
 */
export async function apiDeleteArticle(articleId: string, token: string): Promise<void> {
  const response = await fetch(`${API_BASE}/articles/${articleId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to delete article: ${response.status} ${response.statusText}`);
  }
}

/**
 * Verify image exists in article (checks all storage locations)
 */
export function verifyImageInArticle(article: Article, imageUrl: string): boolean {
  const normalizedUrl = imageUrl.toLowerCase().trim();
  
  // Check images array
  if (article.images?.some(img => img.toLowerCase().trim() === normalizedUrl)) {
    return true;
  }
  
  // Check primaryMedia
  if (article.primaryMedia?.url?.toLowerCase().trim() === normalizedUrl) {
    return true;
  }
  
  // Check supportingMedia
  if (article.supportingMedia?.some(media => media.url?.toLowerCase().trim() === normalizedUrl)) {
    return true;
  }
  
  // Check legacy media field
  if (article.media?.url?.toLowerCase().trim() === normalizedUrl) {
    return true;
  }
  
  return false;
}

/**
 * Get all image URLs from article (normalized)
 */
export function getAllImageUrlsFromArticle(article: Article): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  
  const addIfNotSeen = (url: string | undefined) => {
    if (!url) return;
    const normalized = url.toLowerCase().trim();
    if (!seen.has(normalized)) {
      seen.add(normalized);
      urls.push(url); // Keep original casing
    }
  };
  
  if (article.primaryMedia?.url) addIfNotSeen(article.primaryMedia.url);
  if (article.supportingMedia) {
    article.supportingMedia.forEach(media => addIfNotSeen(media.url));
  }
  if (article.images) {
    article.images.forEach(url => addIfNotSeen(url));
  }
  if (article.media?.url) addIfNotSeen(article.media.url);
  
  return urls;
}

