import { NUGGET_PERFORMANCE } from '@/config/nuggetPerformanceConfig';

/**
 * When set to a positive number (ms), the create modal logs a devtools warning if
 * double-rAF-approx "first paint" after open exceeds the budget. Set to 0 or omit to disable.
 * @see NUGGET_PERFORMANCE.ctpBudgetWarnMs in @/config/nuggetPerformanceConfig
 */
export function getNuggetModalCtpBudgetWarnMs(): number {
  return NUGGET_PERFORMANCE.ctpBudgetWarnMs;
}
