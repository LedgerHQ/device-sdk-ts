import { injectable } from "inversify";

import { type JsonParser } from "@root/src/domain/adapters/JsonParser";

/**
 * Node.js JSON parsing adapter
 * Handles JSON parsing operations
 */
@injectable()
export class NodeJsonParser implements JsonParser {
  /**
   * Parse JSON content from string
   * @param content - JSON content as string
   * @returns T - Parsed JSON object
   * @throws Error if JSON is invalid
   */
  parse<T>(content: string): T {
    try {
      return JSON.parse(content) as T;
    } catch (error) {
      throw new Error(
        `Invalid JSON format: ${error instanceof Error ? error.message : String(error)}`,
        { cause: error },
      );
    }
  }
}
