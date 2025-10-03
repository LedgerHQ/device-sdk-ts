/**
 * Domain model representing a transaction input
 */
export interface TransactionInput {
    readonly rawTx: string;
    readonly txHash?: string;
    readonly description?: string;
    readonly expectedTexts?: string[];
}
