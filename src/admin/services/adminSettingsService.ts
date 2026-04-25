import { apiClient } from '@/services/apiClient';

export interface MediaLimits {
  maxFilesPerUser: number;
  maxStorageMB: number;
  maxDailyUploads: number;
}

export interface UpdateMediaLimitsBody {
  maxFilesPerUser?: number;
  maxStorageMB?: number;
  maxDailyUploads?: number;
}

export interface DisclaimerConfig {
  defaultText: string;
  enableByDefault: boolean;
}

export interface UpdateDisclaimerBody {
  defaultText?: string;
  enableByDefault?: boolean;
}

export interface ValuePropStripConfig {
  title: string;
  body: string;
}

export interface UpdateValuePropStripBody {
  title?: string;
  body?: string;
}

export const adminSettingsService = {
  async getMediaLimits(): Promise<MediaLimits> {
    return apiClient.get<MediaLimits>('/admin/settings/media-limits');
  },

  async updateMediaLimits(body: UpdateMediaLimitsBody): Promise<{ message: string; limits: MediaLimits }> {
    return apiClient.patch<{ message: string; limits: MediaLimits }>('/admin/settings/media-limits', body);
  },

  async getDisclaimerConfig(): Promise<DisclaimerConfig> {
    return apiClient.get<DisclaimerConfig>('/admin/settings/disclaimer');
  },

  async updateDisclaimerConfig(body: UpdateDisclaimerBody): Promise<{ message: string; config: DisclaimerConfig }> {
    return apiClient.patch<{ message: string; config: DisclaimerConfig }>('/admin/settings/disclaimer', body);
  },

  async getValuePropStripConfig(): Promise<ValuePropStripConfig> {
    return apiClient.get<ValuePropStripConfig>('/admin/settings/value-prop-strip');
  },

  async updateValuePropStripConfig(
    body: UpdateValuePropStripBody
  ): Promise<{ message: string; config: ValuePropStripConfig }> {
    return apiClient.patch<{ message: string; config: ValuePropStripConfig }>('/admin/settings/value-prop-strip', body);
  }
};
