import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/services/apiClient';

export interface DisclaimerConfig {
  defaultText: string;
  enableByDefault: boolean;
}

/**
 * Fetches the site-wide disclaimer config.
 * Cached aggressively since it changes infrequently.
 * Used by card rendering to resolve the default disclaimer text.
 */
export function useDisclaimerConfig() {
  return useQuery<DisclaimerConfig>({
    queryKey: ['disclaimerConfig'],
    queryFn: () => apiClient.get<DisclaimerConfig>('/config/disclaimer'),
    staleTime: 1000 * 60 * 10, // 10 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  });
}

/**
 * Resolve the effective disclaimer text for an article.
 * Returns null if disclaimer should not be shown.
 *
 * Backward compatibility: articles without showDisclaimer field
 * fall back to the site-wide enableByDefault setting.
 */
export function resolveDisclaimer(
  article: { showDisclaimer?: boolean; disclaimerText?: string | null },
  defaultConfig: DisclaimerConfig | undefined
): string | null {
  // Explicitly opted out
  if (article.showDisclaimer === false) {
    return null;
  }

  // Explicitly opted in
  if (article.showDisclaimer === true) {
    return article.disclaimerText || defaultConfig?.defaultText || null;
  }

  // Undefined (old articles) — respect site-wide enableByDefault
  if (defaultConfig?.enableByDefault) {
    return defaultConfig.defaultText || null;
  }

  return null;
}
