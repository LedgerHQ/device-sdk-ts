/**
 * Arguments for `SignerEth.registerLedgerAccount`.
 *
 * Registers a signer-controlled Ledger account on the device. The op is
 * a 2-APDU sequence: APDU 1 (RegisterLedgerAccount, requires user
 * approval) returns a 32-byte HMAC proof; APDU 2 (silent GetAddress with
 * chainId framed) derives and returns the ETH address so the wallet can
 * cache it.
 */
export type RegisterLedgerAccountArgs = {
  readonly name: string;
  readonly derivationPath: string;
  readonly chainId: number;
};

export type RegisterLedgerAccountResult = {
  /** 32-byte HMAC proof returned by APDU 1. Lowercase hex, no 0x prefix. */
  readonly hmacProofHex: string;
  /** 20-byte derived ETH address from APDU 2. Lowercase hex, no 0x prefix. */
  readonly addressHex: string;
};
