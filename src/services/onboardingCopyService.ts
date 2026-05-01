import { apiClient } from '@/services/apiClient';

export interface PublicMicroHeaderCopy {
  title: string;
  body: string;
  enabled?: boolean;
}

/** Response from `GET /api/config/onboarding-bundle` — micro-header copy only. */
export interface PublicOnboardingMicroHeaders {
  homeMicroHeader: PublicMicroHeaderCopy;
  marketPulseMicroHeader: PublicMicroHeaderCopy;
}

export const ONBOARDING_PUBLIC_QUERY_KEY = ['public-onboarding-microheaders'] as const;

export const onboardingCopyService = {
  async fetchMicroHeaderBundle(): Promise<PublicOnboardingMicroHeaders> {
    return apiClient.get<PublicOnboardingMicroHeaders>('/config/onboarding-bundle');
  },
};
