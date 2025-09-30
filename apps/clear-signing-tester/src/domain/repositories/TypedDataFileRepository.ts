import { TypedDataInput } from "@root/src/domain/models/TypedDataInput";

/**
 * Repository interface for reading typed data from files
 * This interface abstracts the file reading logic from the domain layer
 */
export interface TypedDataFileRepository {
    /**
     * Read and parse typed data from a file
     * @param filePath - Path to the file containing typed data
     * @returns Promise<InternalTypedData[]> - Array of parsed typed data
     * @throws Error if file doesn't exist, is not readable, or contains invalid JSON
     */
    readTypedDataFromFile(filePath: string): Promise<TypedDataInput[]>;
}
