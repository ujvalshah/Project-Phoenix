import { apiClient } from './apiClient';

/** Legal page metadata (returned by GET /api/legal) */
export interface LegalPageConfig {
  slug: string;
  title: string;
  enabled: boolean;
  noindex: boolean;
  lastUpdated: string;
  effectiveDate: string;
  showInFooter: boolean;
  description: string;
  order: number;
}

/** Full legal page including content (returned by GET /api/legal/:slug) */
export interface LegalPageFull extends LegalPageConfig {
  content: string;
}

export const legalService = {
  /** Fetch all legal page configs (metadata only, no content) */
  getAll: () => apiClient.get<LegalPageConfig[]>('/legal'),

  /** Fetch a single legal page including content */
  getBySlug: (slug: string) => apiClient.get<LegalPageFull>(`/legal/${slug}`),

  /** Admin: update a legal page's metadata and/or content */
  updateBySlug: (slug: string, data: Partial<Omit<LegalPageFull, 'slug'>>) =>
    apiClient.patch<LegalPageFull>(`/admin/legal/${slug}`, data),
};
