/**
 * One contact case: register this contact on the device and assert what the
 * review screens show.
 *
 * Signing is a separate flow. Binding an address book to the signer is the
 * `--address-book` option, so a case here never signs and a signing case never
 * registers — one command, one flow.
 */
export type ContactInput = {
  readonly description: string;
  readonly contactName: string;
  /** Free-text context shown next to the address, e.g. "Ethereum". */
  readonly scope: string;
  readonly address: `0x${string}`;
  readonly chainId: bigint;
  readonly expectedTexts?: string[];
  readonly unexpectedTexts?: string[];
};
