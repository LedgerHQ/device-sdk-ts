export interface TransactionInput {
    readonly rawTx: string;
    readonly txHash?: string;
    readonly description?: string;
    readonly expectedTexts?: string[];
}
