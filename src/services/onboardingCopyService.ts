import { apiClient } from '@/services/apiClient';

export interface ValuePropStripCopy {
  title: string;
  body: string;
}

export const onboardingCopyService = {
  async getValuePropStripCopy(): Promise<ValuePropStripCopy> {
    return apiClient.get<ValuePropStripCopy>('/config/value-prop-strip');
  },

  async getMarketPulseIntroCopy(): Promise<ValuePropStripCopy> {
    return apiClient.get<ValuePropStripCopy>('/config/market-pulse-intro');
  },

  async getHomeMicroHeaderCopy(): Promise<ValuePropStripCopy> {
    return apiClient.get<ValuePropStripCopy>('/config/home-micro-header');
  }
};
