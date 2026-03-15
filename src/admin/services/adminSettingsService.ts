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

export const adminSettingsService = {
  async getMediaLimits(): Promise<MediaLimits> {
    return apiClient.get<MediaLimits>('/admin/settings/media-limits');
  },

  async updateMediaLimits(body: UpdateMediaLimitsBody): Promise<{ message: string; limits: MediaLimits }> {
    return apiClient.patch<{ message: string; limits: MediaLimits }>('/admin/settings/media-limits', body);
  }
};
