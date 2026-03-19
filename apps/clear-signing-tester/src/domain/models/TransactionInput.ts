import { type SignableInputKind } from "./SignableInputKind";

export type TransactionInput = {
  readonly kind: SignableInputKind.Transaction;
  readonly rawTx: string;
  readonly txHash?: string;
  readonly description?: string;
  readonly expectedTexts?: string[];
  // Solana-only: skip replacing the payer key with the device key before signing
  readonly skipCraft?: boolean;
};
