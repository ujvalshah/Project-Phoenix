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

/** Homepage / Market Pulse micro-header (H1 + line) from admin settings. */
export interface MicroHeaderCopyConfig {
  title: string;
  body: string;
  enabled?: boolean;
}

export interface UpdateMicroHeaderCopyBody {
  title?: string;
  body?: string;
  enabled?: boolean;
}

export const adminSettingsService = {
  getMediaLimits(): Promise<MediaLimits> {
    return apiClient.get<MediaLimits>('/admin/settings/media-limits');
  },

  updateMediaLimits(body: UpdateMediaLimitsBody): Promise<{ message: string; limits: MediaLimits }> {
    return apiClient.patch<{ message: string; limits: MediaLimits }>('/admin/settings/media-limits', body);
  },

  getDisclaimerConfig(): Promise<DisclaimerConfig> {
    return apiClient.get<DisclaimerConfig>('/admin/settings/disclaimer');
  },

  updateDisclaimerConfig(body: UpdateDisclaimerBody): Promise<{ message: string; config: DisclaimerConfig }> {
    return apiClient.patch<{ message: string; config: DisclaimerConfig }>('/admin/settings/disclaimer', body);
  },

  getHomeMicroHeaderConfig(): Promise<MicroHeaderCopyConfig> {
    return apiClient.get<MicroHeaderCopyConfig>('/admin/settings/home-micro-header');
  },

  updateHomeMicroHeaderConfig(
    body: UpdateMicroHeaderCopyBody
  ): Promise<{ message: string; config: MicroHeaderCopyConfig }> {
    return apiClient.patch<{ message: string; config: MicroHeaderCopyConfig }>(
      '/admin/settings/home-micro-header',
      body,
    );
  },

  getMarketPulseMicroHeaderConfig(): Promise<MicroHeaderCopyConfig> {
    return apiClient.get<MicroHeaderCopyConfig>('/admin/settings/market-pulse-micro-header');
  },

  updateMarketPulseMicroHeaderConfig(
    body: UpdateMicroHeaderCopyBody
  ): Promise<{ message: string; config: MicroHeaderCopyConfig }> {
    return apiClient.patch<{ message: string; config: MicroHeaderCopyConfig }>(
      '/admin/settings/market-pulse-micro-header',
      body,
    );
  },
};
