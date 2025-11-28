/**
 * Screen analyzer interface for screen content processing and analysis
 * Provides abstraction for screen content reading and state analysis
 */
export interface ScreenAnalyzerService {
  /**
   * Check if the current screen is the home page
   * @returns Promise<boolean> - True if on home page
   */
  isHomePage(): Promise<boolean>;

  /**
   * Check if the current screen is the last page
   * @returns Promise<boolean> - True if on last page
   */
  isLastPage(): Promise<boolean>;

  /**
   * Check if the current screen allows transaction refusal
   * @returns Promise<boolean> - True if can refuse transaction
   */
  canRefuseTransaction(): Promise<boolean>;

  /**
   * Analyze all accumulated screen texts for expected texts
   * @param expectedTexts - Array of texts to look for
   * @returns Promise<{ containsAll: boolean; found: string[]; missing: string[] }> - Result of the analysis
   */
  analyzeAccumulatedTexts(
    expectedTexts: string[],
  ): Promise<{ containsAll: boolean; found: string[]; missing: string[] }>;
}
