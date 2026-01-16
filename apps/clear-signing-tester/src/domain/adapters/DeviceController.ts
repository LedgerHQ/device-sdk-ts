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
   * Acknowledge blind signing on the device
   */
  acknowledgeBlindSigning(): Promise<void>;

  /**
   * Navigate to the next screen
   */
  navigateNext(): Promise<void>;

  /**
   * Navigate to the previous screen
   */
  navigatePrevious(): Promise<void>;
}
