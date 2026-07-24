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
   * Check if the current screen allows blind signing acknowledgement
   * @returns Promise<boolean> - True if can acknowledge blind signing
   */
  canAcknowledgeBlindSigning(): Promise<boolean>;

  /**
   * Check if the current screen is a blind signing warning
   * @returns Promise<boolean> - True if the screen shows "Blind signing ahead" or similar
   */
  isBlindSigningWarning(): Promise<boolean>;

  /**
   * Check if the current screen is the "safer way to sign" prompt
   * with a "Continue to blind signing" button
   * @returns Promise<boolean> - True if the screen shows "Continue to blind signing"
   */
  isContinueToBlindSigningScreen(): Promise<boolean>;

  /**
   * Check if the current screen indicates blind signing is not enabled,
   * blocking the signing flow (e.g. "Go to settings" / "Reject transaction")
   * @returns Promise<boolean> - True if blind signing is blocked
   */
  isBlindSigningBlocked(): Promise<boolean>;

  /**
   * Check if the Web3 Checks opt-in modal has rendered before sending touchScreen events.
   * If the rendering is not done, this can cause misclick on the "Quit app" zone.
   * @returns Promise<boolean> - True if the Web3 Checks opt-in modal is shown
   */
  isWeb3ChecksOptInScreen(): Promise<boolean>;

  /**
   * Analyze all accumulated screen texts for expected texts
   * @param expectedTexts - Array of texts to look for
   * @returns Promise<{ containsAll: boolean; found: string[]; missing: string[] }> - Result of the analysis
   */
  analyzeAccumulatedTexts(
    expectedTexts: string[],
  ): Promise<{ containsAll: boolean; found: string[]; missing: string[] }>;
}
