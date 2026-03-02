/**
 * Device Controller Interface
 *
 * Common interface for all device controllers (Stax, NanoX, etc.)
 * Provides abstraction for device-specific interactions
 */
export interface DeviceController {
  /**
   * Execute a sign operation
   */
  signTransaction(): Promise<void>;

  /**
   * Execute a reject operation
   */
  rejectTransaction(): Promise<void>;

  /**
   * Reject transaction checks opt-in on the device
   */
  rejectTransactionCheck(): Promise<void>;

  /**
   * Acknowledge blind signing on the device (go back to safety)
   */
  acknowledgeBlindSigning(): Promise<void>;

  /**
   * Accept the blind signing warning and proceed with the transaction review
   */
  acceptBlindSigning(): Promise<void>;

  /**
   * Tap "Continue to blind signing" on the "safer way to sign" screen
   */
  continueToBlindSigning(): Promise<void>;

  /**
   * Navigate to the Ethereum app settings and enable the blind signing toggle
   */
  enableBlindSigningInSettings(): Promise<void>;

  /**
   * Navigate to the next screen
   */
  navigateNext(): Promise<void>;

  /**
   * Navigate to the previous screen
   */
  navigatePrevious(): Promise<void>;
}
