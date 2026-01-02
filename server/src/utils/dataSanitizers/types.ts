/**
 * Types for database sanitization system
 */

export type IssueType = 
  | 'orphaned_reference'
  | 'stale_document'
  | 'invalid_field'
  | 'missing_required_field'
  | 'orphaned_link';

export type CleanupCategory = 
  | 'SAFE_AUTO_FIX'
  | 'CONDITIONAL_CLEANUP'
  | 'DO_NOT_TOUCH';

export interface SanitizationIssue {
  collection: string;
  issueType: IssueType;
  description: string;
  count: number;
  sampleIds: string[];
  category: CleanupCategory;
  field?: string;
  details?: Record<string, any>;
}

export interface SanitizationReport {
  timestamp: string;
  dryRun: boolean;
  issues: SanitizationIssue[];
  summary: {
    totalIssues: number;
    totalAffectedRecords: number;
    byCategory: Record<CleanupCategory, number>;
    byCollection: Record<string, number>;
  };
}

export interface CleanupResult {
  collection: string;
  operation: string;
  recordsScanned: number;
  recordsCleaned: number;
  recordsSkipped: number;
  errors: string[];
  details?: Record<string, any>;
}

export interface SanitizationStats {
  totalScanned: number;
  totalCleaned: number;
  totalSkipped: number;
  totalErrors: number;
  byCollection: Record<string, CleanupResult>;
}











