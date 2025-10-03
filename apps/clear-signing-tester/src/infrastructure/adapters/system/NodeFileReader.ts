import { readFileSync } from "fs";
import { injectable } from "inversify";

/**
 * Node.js file reading adapter
 * Handles low-level file operations using Node.js fs module
 */
@injectable()
export class NodeFileReader {
    /**
     * Read file content synchronously
     * @param filePath - Path to the file to read
     * @returns string - File content as string
     * @throws Error if file doesn't exist or is not readable
     */
    readFileSync(filePath: string): string {
        try {
            return readFileSync(filePath, "utf-8");
        } catch (error) {
            if (error instanceof Error && error.message.includes("ENOENT")) {
                throw new Error(`File not found: ${filePath}`);
            }
            throw new Error(
                `Error reading file ${filePath}: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    /**
     * Parse JSON content from string
     * @param content - JSON content as string
     * @returns T - Parsed JSON object
     * @throws Error if JSON is invalid
     */
    parseJson<T>(content: string): T {
        try {
            return JSON.parse(content) as T;
        } catch (error) {
            throw new Error(
                `Invalid JSON format: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }
}
