import { inject, injectable } from "inversify";

import { TYPES } from "@root/src/di/types";
import { type FileReader } from "@root/src/domain/adapters/FileReader";
import { type JsonParser } from "@root/src/domain/adapters/JsonParser";
import { type TransactionCrafter } from "@root/src/domain/adapters/TransactionCrafter";
import { type TransactionInput } from "@root/src/domain/models/TransactionInput";
import { type DataFileRepository } from "@root/src/domain/repositories/DataFileRepository";

/**
 * Raw transaction data structure from JSON file
 */
type RawTransactionData = {
  rawTx: string;
  txHash?: string;
  description?: string;
  expectedTexts?: string[];
};

/**
 * File-based implementation of DataFileRepository for TransactionInput
 * Reads transaction data from JSON files using FileReader
 */
@injectable()
export class TransactionFileRepository
  implements DataFileRepository<TransactionInput>
{
  constructor(
    @inject(TYPES.FileReader)
    private readonly fileReader: FileReader,
    @inject(TYPES.JsonParser)
    private readonly jsonParser: JsonParser,
    @inject(TYPES.TransactionCrafter)
    private readonly transactionCrafter: TransactionCrafter,
  ) {}

  /**
   * Read and parse transactions from a JSON file
   * @param filePath - Path to the JSON file containing transactions
   * @returns TransactionInput[] - Array of parsed TransactionInput objects
   * @throws Error if file doesn't exist, is not readable, or contains invalid data
   */
  readFromFile(filePath: string): TransactionInput[] {
    const fileContent = this.fileReader.readFileSync(filePath);

    const rawTransactions =
      this.jsonParser.parse<RawTransactionData[]>(fileContent);

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
   * Map raw transaction data to TransactionInput domain model
   * @param rawTx - Raw transaction data from JSON
   * @param index - Index of the transaction in the array (for error reporting)
   * @returns TransactionInput - Domain model transaction
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

    const unsignedRawTx = this.transactionCrafter.unsignRawTransaction(
      rawTx.rawTx,
    );

    return {
      rawTx: unsignedRawTx,
      description: rawTx.description || `Transaction ${index + 1}`,
      txHash: rawTx.txHash,
      expectedTexts: rawTx.expectedTexts,
    };
  }
}
