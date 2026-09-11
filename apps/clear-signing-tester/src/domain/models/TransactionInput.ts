import { type SignableInputKind } from "./SignableInputKind";

/** Domain model representing a serialised transaction to be signed on the device. */
export type TransactionInput = {
  readonly kind: SignableInputKind.Transaction;
  readonly rawTx: string;
  readonly description?: string;
  readonly expectedTexts?: string[];
  /** Texts that must NOT appear on any screen of this signing flow. */
  readonly unexpectedTexts?: string[];
  /**
   * Set when the transaction cannot be clear-signed and the point of the case
   * is that the device falls back to blind signing. Such a case passes on
   * `blind_signed` and fails if it ever clear-signs or errors.
   */
  readonly expectBlindSigned?: boolean;
  // Solana-only: skip replacing the payer key with the device key before signing
  readonly skipCraft?: boolean;
};
