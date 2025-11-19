/**
 * Transaction Data Model
 *
 * Represents transaction data structure used for testing purposes.
 * Contains essential transaction fields needed for transaction simulation.
 */
export type TransactionData = {
  /** The recipient address of the transaction */
  to: string;
  /** The transaction nonce */
  nonce: number;
  /** The transaction data payload (hex string) */
  data: string;
  /** The transaction value in wei (hex string) */
  value: string;
  /** The transaction selector */
  selector: string;
  /** The transaction hash */
  hash: string;
};
