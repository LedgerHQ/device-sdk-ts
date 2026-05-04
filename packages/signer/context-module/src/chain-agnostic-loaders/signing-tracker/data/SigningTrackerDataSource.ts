/**
 * Data source for tracking signing events.
 *
 * Implement this interface to POST signing context to an external API
 * for blind-signing tracking or auditing purposes.
 *
 * The `reportSigningContext` method is called just before the device
 * signature request, after contexts have been provided to the device,
 * when the blind-sign status is known.
 *
 * @example
 * ```ts
 * const myTracker: SigningTrackerDataSource = {
 *   reportSigningContext: async (params) => {
 *     await fetch("https://my-api.example.com/signing-events", {
 *       method: "POST",
 *       headers: { "Content-Type": "application/json" },
 *       body: JSON.stringify(params),
 *     });
 *   },
 * };
 *
 * const contextModule = new ContextModuleBuilder({ ... })
 *   .setSigningTrackerDataSource(myTracker)
 *   .build();
 * ```
 */
export interface SigningTrackerDataSource {
  /**
   * Report signing context to an external API.
   *
   * Called with the full signing context info (including `isBlindSign`
   * status) just before the signature is requested from the device.
   *
   * @param params - The signing context info. Shape varies by signer
   *   (ETH vs Solana) but always contains `signatureId` and `isBlindSign`.
   */
  reportSigningContext(params: Record<string, unknown>): Promise<void>;
}
