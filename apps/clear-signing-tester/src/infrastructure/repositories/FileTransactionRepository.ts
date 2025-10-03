import { inject, injectable } from "inversify";

import { TYPES } from "@root/src/di/types";
import { type TransactionInput } from "@root/src/domain/models/TransactionInput";
import { type TransactionFileRepository } from "@root/src/domain/repositories/TransactionFileRepository";
import { type FileReader } from "@root/src/domain/adapters/FileReader";

/**
 * Raw transaction data structure from JSON file
 */
interface RawTransactionData {
    rawTx: string;
    txHash?: string;
    description?: string;
    expectedTexts?: string[];
}

/**
 * File-based implementation of TransactionFileRepository
 * Reads transaction data from JSON files using NodeFileReader
 */
@injectable()
export class FileTransactionRepository implements TransactionFileRepository {
    constructor(
        @inject(TYPES.FileReader)
        private readonly fileReader: FileReader,
    ) {}

    /**
     * Read and parse transactions from a JSON file
     * @param filePath - Path to the JSON file containing transactions
     * @returns Transaction[] - Array of parsed Transaction objects
     * @throws Error if file doesn't exist, is not readable, or contains invalid data
     */
    readTransactionsFromFile(filePath: string): TransactionInput[] {
        const fileContent = this.fileReader.readFileSync(filePath);

        const rawTransactions =
            this.fileReader.parseJson<RawTransactionData[]>(fileContent);

        if (!Array.isArray(rawTransactions)) {
            throw new Error(
                `Invalid file format: expected an array of transactions in ${filePath}`,
            );
        }

        return rawTransactions.map((rawTx, index) =>
            this.mapToTransaction(rawTx, index),
        );
    }

    /**
     * Map raw transaction data to Transaction domain model
     * @param rawTx - Raw transaction data from JSON
     * @param index - Index of the transaction in the array (for error reporting)
     * @returns Transaction - Domain model transaction
     * @throws Error if required fields are missing
     */
    private mapToTransaction(
        rawTx: RawTransactionData,
        index: number,
    ): TransactionInput {
        if (!rawTx.rawTx) {
            throw new Error(
                `Transaction at index ${index} is missing required field 'rawTx'`,
            );
        }

        return {
            rawTx: rawTx.rawTx,
            description: rawTx.description || `Transaction ${index + 1}`,
            txHash: rawTx.txHash,
            expectedTexts: rawTx.expectedTexts,
        };
    }
}
