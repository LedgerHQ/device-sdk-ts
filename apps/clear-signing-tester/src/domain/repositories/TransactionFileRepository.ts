import { TransactionInput } from "@root/src/domain/models/TransactionInput";

/**
 * Repository interface for reading transactions from files
 * This interface abstracts the file reading logic from the domain layer
 */
export interface TransactionFileRepository {
    /**
     * Read and parse transactions from a file
     * @param filePath - Path to the file containing transactions
     * @returns Promise<Transaction[]> - Array of parsed transactions
     * @throws Error if file doesn't exist, is not readable, or contains invalid JSON
     */
    readTransactionsFromFile(filePath: string): Promise<TransactionInput[]>;
}
