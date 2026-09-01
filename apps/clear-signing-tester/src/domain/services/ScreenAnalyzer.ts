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
   * Check whether the screen showing right now contains `marker`, matched
   * case-insensitively. For screens with no dedicated predicate above.
   * @param marker - Lowercase text to look for on the current screen
   * @returns Promise<boolean> - True if the marker is on screen
   */
  screenContains(marker: string): Promise<boolean>;

  /**
   * Analyze all accumulated screen texts for expected texts
   *
   * Clears the accumulated buffer, so each call scopes its assertion to the
   * screens produced since the previous call.
   *
   * @param expectedTexts - Array of texts that must appear
   * @param unexpectedTexts - Array of texts that must not appear
   * @returns Promise<ScreenTextAnalysis> - Result of the analysis
   */
  analyzeAccumulatedTexts(
    expectedTexts: string[],
    unexpectedTexts?: string[],
  ): Promise<ScreenTextAnalysis>;
}

/** Outcome of matching a set of texts against the accumulated screens. */
export type ScreenTextAnalysis = {
  /** True when every expected text was found and no unexpected one was. */
  readonly containsAll: boolean;
  readonly found: string[];
  readonly missing: string[];
  /** Texts from `unexpectedTexts` that were found on screen anyway. */
  readonly forbidden: string[];
};
