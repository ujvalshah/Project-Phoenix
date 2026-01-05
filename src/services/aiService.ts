/**
 * AI Service - STUBBED OUT
 * 
 * AI creation system has been fully removed.
 * This file is kept as a stub to prevent import errors in legacy code.
 * All AI endpoints have been removed from the backend.
 */

export interface SummaryResult {
  title: string;
  excerpt: string;
  tags: string[];
}

export const aiService = {
  /**
   * @deprecated AI summarization has been removed
   */
  async summarizeText(_text: string): Promise<SummaryResult> {
    throw new Error('AI summarization has been permanently removed. Please create articles manually.');
  },

  /**
   * @deprecated AI takeaways generation has been removed
   */
  async generateTakeaways(_text: string): Promise<string> {
    throw new Error('AI takeaways generation has been permanently removed. Please create articles manually.');
  }
};
