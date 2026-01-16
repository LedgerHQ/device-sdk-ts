/**
 * Repository interface for reading files
 * This interface abstracts the file reading logic from the domain layer
 */
export interface DataFileRepository<T> {
  /**
   * Read and parse data from a file
   * @param filePath - Path to the file containing data
   * @returns T[] - Array of parsed data
   * @throws Error if file doesn't exist, is not readable, or contains invalid data
   */
  readFromFile(filePath: string): T[];
}
