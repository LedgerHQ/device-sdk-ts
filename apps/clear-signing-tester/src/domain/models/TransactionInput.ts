/**
 * Domain model representing a transaction input
 */
export type TransactionInput = {
  readonly rawTx: string;
  readonly txHash?: string;
  readonly description?: string;
  readonly expectedTexts?: string[];
};
