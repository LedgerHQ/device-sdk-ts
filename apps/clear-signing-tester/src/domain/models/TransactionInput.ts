import { type SignableInputKind } from "./SignableInputKind";

/** Domain model representing a serialised transaction to be signed on the device. */
export type TransactionInput = {
  readonly kind: SignableInputKind.Transaction;
  readonly rawTx: string;
  readonly txHash?: string;
  readonly description?: string;
  readonly expectedTexts?: string[];
  /** Texts that must NOT appear on any screen of this signing flow. */
  readonly unexpectedTexts?: string[];
  // Solana-only: skip replacing the payer key with the device key before signing
  readonly skipCraft?: boolean;
};
