import { AdminReport } from '../types/admin';
import { apiClient } from '@/services/apiClient';
import { mapReportToAdminReport, RawReport } from './adminApiMappers';

class AdminModerationService {
  async listReports(filter?: 'open' | 'resolved' | 'dismissed', cancelKey?: string): Promise<AdminReport[]> {
    // Build query params - always send status, default to 'open'
    const params = new URLSearchParams();
    const statusFilter = filter || 'open'; // Default to 'open' if not provided
    params.append('status', statusFilter);
    
    const queryString = params.toString();
    const endpoint = `/moderation/reports?${queryString}`;
    
    // Use provided cancelKey or default to service method name
    // This allows parallel requests (like in getStats) to use unique keys
    const requestCancelKey = cancelKey || 'adminModerationService.listReports';
    const response = await apiClient.get<{ data: RawReport[] } | RawReport[]>(endpoint, undefined, requestCancelKey);
    
    // Handle paginated response format { data: [...], total, ... } or direct array
    const reports = Array.isArray(response) ? response : (response.data || []);
    
    if (!Array.isArray(reports)) {
      console.error('[AdminModerationService] Expected reports array but got:', typeof reports, response);
      return [];
    }
    
    return reports.map(mapReportToAdminReport);
  }

  async getReportDetails(id: string): Promise<AdminReport | undefined> {
    // Backend doesn't have GET /moderation/reports/:id
    // Get all reports and find by id
    const reports = await this.listReports();
    return reports.find(r => r.id === id);
  }

  async getStats(cancelKey?: string): Promise<{ open: number; resolved: number; dismissed: number }> {
    // Fetch all statuses separately for accurate counts
    // Use unique cancellation keys for each parallel request to prevent mutual cancellation
    // If a cancelKey is provided, append it to make stats requests independent from list requests
    const keyPrefix = cancelKey || 'adminModerationService.getStats';
    const [openReports, resolvedReports, dismissedReports] = await Promise.all([
      this.listReports('open', `${keyPrefix}.open`),
      this.listReports('resolved', `${keyPrefix}.resolved`),
      this.listReports('dismissed', `${keyPrefix}.dismissed`)
    ]);
    
    return {
      open: openReports.length,
      resolved: resolvedReports.length,
      dismissed: dismissedReports.length,
    };
  }

  async resolveReport(id: string, actionReason?: string): Promise<AdminReport> {
    const response = await apiClient.post<{ data: RawReport } | RawReport>(
      `/moderation/reports/${id}/resolve`,
      { actionReason: actionReason || undefined }
    );
    // Handle both response formats: { data: RawReport } or RawReport
    const report = (response as any).data || response as RawReport;
    return mapReportToAdminReport(report);
  }

  async dismissReport(id: string, actionReason?: string): Promise<AdminReport> {
    const response = await apiClient.post<{ data: RawReport } | RawReport>(
      `/moderation/reports/${id}/dismiss`,
      { actionReason: actionReason || undefined }
    );
    // Handle both response formats: { data: RawReport } or RawReport
    const report = (response as any).data || response as RawReport;
    return mapReportToAdminReport(report);
  }

  async submitReport(
    targetId: string,
    targetType: 'nugget' | 'user' | 'collection',
    reason: 'spam' | 'misleading' | 'abusive' | 'copyright' | 'other',
    description?: string,
    reporter?: { id: string; name: string },
    respondent?: { id: string; name: string }
  ): Promise<void> {
    // Map frontend reason codes to backend reason codes
    const reasonMap: Record<string, 'spam' | 'harassment' | 'misinformation' | 'copyright' | 'other'> = {
      'spam': 'spam',
      'misleading': 'misinformation',
      'abusive': 'harassment',
      'copyright': 'copyright',
      'other': 'other'
    };

    const payload: any = {
      targetId,
      targetType,
      reason: reasonMap[reason] || 'other',
      description: description || undefined,
      reporter: reporter || { id: 'anonymous', name: 'Anonymous' },
    };

    if (respondent) {
      payload.respondent = respondent;
    }

    await apiClient.post('/moderation/reports', payload);
  }
}

export const adminModerationService = new AdminModerationService();
