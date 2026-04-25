import { apiClient } from '@/services/apiClient';

export interface ValuePropStripCopy {
  title: string;
  body: string;
}

export const onboardingCopyService = {
  async getValuePropStripCopy(): Promise<ValuePropStripCopy> {
    return apiClient.get<ValuePropStripCopy>('/config/value-prop-strip');
  }
};
