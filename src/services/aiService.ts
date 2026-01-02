
import { apiClient } from './apiClient';

export interface SummaryResult {
  title: string;
  excerpt: string;
  tags: string[];
}

export const aiService = {
  /**
   * Summarizes the provided text into a nugget-friendly format via Backend API.
   * This keeps the API key secure on the server.
   */
  async summarizeText(text: string): Promise<SummaryResult> {
    if (!text || text.length < 10) {
      throw new Error("Text is too short to summarize.");
    }

    try {
      // POST to our own backend, which then talks to Gemini
      const response = await apiClient.post<SummaryResult>('/ai/summarize', { text });
      return response;
    } catch (e) {
      console.error("AI Service Error:", e);
      // Return empty fallback
      return {
        title: '',
        excerpt: '',
        tags: []
      };
    }
  },

  /**
   * Generates concise key takeaways via Backend API.
   */
  async generateTakeaways(text: string): Promise<string> {
    if (!text || text.length < 50) return "This content is too short to summarize.";

    try {
      const response = await apiClient.post<{ takeaway: string }>('/ai/takeaways', { text });
      return response.takeaway;
    } catch (e) {
      console.error("AI Summary Error:", e);
      return "Failed to generate summary. Please try again later.";
    }
  }
};
