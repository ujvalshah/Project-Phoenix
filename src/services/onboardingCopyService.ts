import { apiClient } from '@/services/apiClient';

export interface ValuePropStripCopy {
  title: string;
  body: string;
  enabled?: boolean;
}

/** Response from `GET /api/config/onboarding-bundle` — same payloads as legacy per-key routes. */
export interface PublicOnboardingCopyBundle {
  valuePropStrip: ValuePropStripCopy;
  marketPulseIntro: ValuePropStripCopy;
  homeMicroHeader: ValuePropStripCopy;
  marketPulseMicroHeader: ValuePropStripCopy;
}

export const ONBOARDING_PUBLIC_QUERY_KEY = ['public-onboarding-bundle'] as const;

export const onboardingCopyService = {
  /**
   * Preferred: one round-trip for all homepage onboarding / micro-header copy used on `HomePage`.
   */
  async fetchPublicBundle(): Promise<PublicOnboardingCopyBundle> {
    return apiClient.get<PublicOnboardingCopyBundle>('/config/onboarding-bundle');
  },

  /** @deprecated Prefer `fetchPublicBundle` for homepage—kept for compatibility or tooling. */
  async getValuePropStripCopy(): Promise<ValuePropStripCopy> {
    return apiClient.get<ValuePropStripCopy>('/config/value-prop-strip');
  },

  /** @deprecated Prefer `fetchPublicBundle`. */
  async getMarketPulseIntroCopy(): Promise<ValuePropStripCopy> {
    return apiClient.get<ValuePropStripCopy>('/config/market-pulse-intro');
  },

  /** @deprecated Prefer `fetchPublicBundle`. */
  async getHomeMicroHeaderCopy(): Promise<ValuePropStripCopy> {
    return apiClient.get<ValuePropStripCopy>('/config/home-micro-header');
  },

  /** @deprecated Prefer `fetchPublicBundle`. */
  async getMarketPulseMicroHeaderCopy(): Promise<ValuePropStripCopy> {
    return apiClient.get<ValuePropStripCopy>('/config/market-pulse-micro-header');
  },
};
