import { apiClient } from '@/services/apiClient';

export interface ValuePropStripCopy {
  title: string;
  body: string;
  enabled?: boolean;
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
  },

  async getMarketPulseMicroHeaderCopy(): Promise<ValuePropStripCopy> {
    return apiClient.get<ValuePropStripCopy>('/config/market-pulse-micro-header');
  }
};
