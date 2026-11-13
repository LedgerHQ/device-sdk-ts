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
   * Check if the current screen accepts one step of a review that goes on
   * after it, such as one output on the legacy Bitcoin apps of a Nano
   * @returns Promise<boolean> - True if the screen is a bare "Accept"
   */
  isStepAcceptPage(): Promise<boolean>;

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
   * @param marker - Text to look for on the current screen, in any case
   * @returns Promise<boolean> - True if the marker is on screen
   */
  screenContains(marker: string): Promise<boolean>;

  /**
   * Check if the Web3 Checks opt-in modal has rendered before sending touchScreen events.
   * If the rendering is not done, this can cause misclick on the "Quit app" zone.
   * @returns Promise<boolean> - True if the Web3 Checks opt-in modal is shown
   */
  isWeb3ChecksOptInScreen(): Promise<boolean>;

  /**
   * Check if the Transaction Check opt-in is still on screen after a tap: its
   * modal, or the "Transaction Check enabled" confirmation that follows it
   * @returns Promise<boolean> - True while either is shown
   */
  isTransactionCheckOptInShown(): Promise<boolean>;

  /**
   * Check if the current screen is the warning a Transaction Check risk or
   * threat verdict shows before the review ("Potential risk" / "Critical
   * threat", with "Back to safety")
   * @returns Promise<boolean> - True if the screen is that warning
   */
  isTransactionCheckWarning(): Promise<boolean>;

  /**
   * Analyze all accumulated screen texts for expected texts
   *
   * Clears the accumulated buffer, so each call scopes its assertion to the
   * screens produced since the previous call.
   *
   * @param expectedTexts - Array of texts that must appear
   * @param unexpectedTexts - Array of texts that must not appear
   * @param oneOfTexts - Texts of which at least one must appear; empty means
   * no such requirement
   * @returns Promise<ScreenTextAnalysis> - Result of the analysis
   */
  analyzeAccumulatedTexts(
    expectedTexts: string[],
    unexpectedTexts?: string[],
    oneOfTexts?: readonly string[],
  ): Promise<ScreenTextAnalysis>;
}

/** Outcome of matching a set of texts against the accumulated screens. */
export type ScreenTextAnalysis = {
  /**
   * True when every expected text was found, no unexpected one was, and one of
   * `oneOfTexts` was when any were given.
   */
  readonly containsAll: boolean;
  readonly found: string[];
  readonly missing: string[];
  /** Texts from `unexpectedTexts` that were found on screen anyway. */
  readonly forbidden: string[];
  /** Texts from `oneOfTexts` that were found on screen. */
  readonly foundOneOf: string[];
};
