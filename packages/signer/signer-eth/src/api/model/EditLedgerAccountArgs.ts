/**
 * Arguments for `SignerEth.editLedgerAccount`.
 *
 * Renames a previously-registered signer-controlled Ledger account. Single
 * APDU (EditLedgerAccount, requires user approval): the device re-derives the
 * seed-bound HMAC key at `derivationPath`, verifies `hmacProofHex` (the proof
 * from the prior registration) and rejects with SW 0x6982 — *before* showing
 * the rename review — when it was minted under a different seed. On approval it
 * returns a freshly rotated HMAC proof to persist.
 */
export type EditLedgerAccountArgs = {
  /** New account name. */
  readonly name: string;
  /** Current (previous) account name. */
  readonly oldName: string;
  readonly derivationPath: string;
  readonly chainId: number;
  /** 32-byte HMAC proof from the previous registration. Lowercase hex, no 0x. */
  readonly hmacProofHex: string;
};

export type EditLedgerAccountResult = {
  /** Freshly rotated 32-byte HMAC proof. Lowercase hex, no 0x prefix. */
  readonly hmacProofHex: string;
};
