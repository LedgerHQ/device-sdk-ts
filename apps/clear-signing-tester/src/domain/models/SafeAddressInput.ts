/**
 * One Safe address case: ask the device to verify this Safe account and
 * assert what its review screens show.
 */
export type SafeAddressInput = {
  readonly description: string;
  readonly safeContractAddress: string;
  readonly chainId: number;
  readonly expectedTexts?: string[];
  readonly unexpectedTexts?: string[];
};
