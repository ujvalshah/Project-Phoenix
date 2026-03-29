import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo, useCallback } from 'react';
import { legalService, type LegalPageConfig, type LegalPageFull } from '@/services/legalService';

const LEGAL_PAGES_KEY = ['legal-pages'] as const;
const LEGAL_STALE_TIME = 10 * 60 * 1000; // 10 minutes — legal pages rarely change

/**
 * Hook for consuming legal page configs (metadata only).
 */
export function useLegalPages() {
  const { data: allPages = [], isLoading, error } = useQuery({
    queryKey: LEGAL_PAGES_KEY,
    queryFn: legalService.getAll,
    staleTime: LEGAL_STALE_TIME,
  });

  const enabledPages = useMemo(
    () => allPages.filter((p) => p.enabled).sort((a, b) => a.order - b.order),
    [allPages]
  );

  const footerPages = useMemo(
    () => enabledPages.filter((p) => p.showInFooter),
    [enabledPages]
  );

  const getPageBySlug = useCallback(
    (slug: string): LegalPageConfig | undefined =>
      allPages.find((p) => p.slug === slug),
    [allPages]
  );

  return {
    /** All pages including disabled (for admin) */
    allPages,
    /** Only enabled pages, sorted by order */
    enabledPages,
    /** Enabled pages with showInFooter */
    footerPages,
    /** Find a page by slug (includes disabled) */
    getPageBySlug,
    isLoading,
    error,
  };
}

/**
 * Hook for fetching a single legal page with content (by slug).
 */
export function useLegalPageFull(slug: string | undefined) {
  return useQuery({
    queryKey: ['legal-page', slug],
    queryFn: () => legalService.getBySlug(slug!),
    enabled: !!slug,
    staleTime: LEGAL_STALE_TIME,
  });
}

/**
 * Hook for admin: update a legal page's metadata and/or content.
 */
export function useUpdateLegalPage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ slug, data }: { slug: string; data: Partial<Omit<LegalPageFull, 'slug'>> }) =>
      legalService.updateBySlug(slug, data),
    onSuccess: (_result, { slug }) => {
      queryClient.invalidateQueries({ queryKey: LEGAL_PAGES_KEY });
      queryClient.invalidateQueries({ queryKey: ['legal-page', slug] });
    },
  });
}
