import { inject, injectable } from "inversify";

import { TYPES } from "@root/src/di/types";
import { type FileReader } from "@root/src/domain/adapters/FileReader";
import { type JsonParser } from "@root/src/domain/adapters/JsonParser";
import {
  type ContractFileData,
  type ContractInput,
} from "@root/src/domain/models/ContractInput";
import { type DataFileRepository } from "@root/src/domain/repositories/DataFileRepository";

/**
 * File-based implementation of DataFileRepository for ContractInput
 * Reads contract data from JSON files using FileReader
 */
@injectable()
export class ContractFileRepository
  implements DataFileRepository<ContractInput>
{
  constructor(
    @inject(TYPES.FileReader)
    private readonly fileReader: FileReader,
    @inject(TYPES.JsonParser)
    private readonly jsonParser: JsonParser,
  ) {}

  /**
   * Parse and validate ContractFileData structure
   * @throws Error if data is not valid ContractFileData
   * @returns ContractFileData
   */
  private parseContractFileData(
    data: unknown,
    filePath: string,
  ): ContractFileData {
    if (!data || typeof data !== "object") {
      throw new Error(`Invalid file format: expected an object in ${filePath}`);
    }

    const obj = data as Record<string, unknown>;
    if (!("test" in obj) || !Array.isArray(obj["test"])) {
      throw new Error(
        `Invalid file format: expected a 'test' array in ${filePath}`,
      );
    }

    return data as ContractFileData;
  }

  /**
   * Type guard to check if an object is a valid ContractInput
   */
  private isContractInput(obj: unknown): obj is ContractInput {
    if (!obj || typeof obj !== "object") {
      return false;
    }

    const contract = obj as Record<string, unknown>;

    // Check name
    if (!("name" in contract) || typeof contract["name"] !== "string") {
      return false;
    }

    // Check owner
    if (!("owner" in contract) || typeof contract["owner"] !== "string") {
      return false;
    }

    // Check address
    if (
      !("address" in contract) ||
      !contract["address"] ||
      typeof contract["address"] !== "object" ||
      Array.isArray(contract["address"])
    ) {
      return false;
    }

    // Check that address has at least one entry and all values are strings
    const address = contract["address"] as Record<string, unknown>;
    const entries = Object.entries(address);
    if (entries.length === 0) {
      return false;
    }

    for (const [, value] of entries) {
      if (typeof value !== "string") {
        return false;
      }
    }

    return true;
  }

  /**
   * Read and parse contracts from a JSON file
   * @param filePath - Path to the JSON file containing contracts
   * @returns ContractInput[] - Array of parsed ContractInput objects
   * @throws Error if file doesn't exist, is not readable, or contains invalid data
   */
  readFromFile(filePath: string): ContractInput[] {
    const fileContent = this.fileReader.readFileSync(filePath);
    const parsed = this.jsonParser.parse<unknown>(fileContent);

    // Parse and validate data structure (throws if not valid)
    const contractFileData = this.parseContractFileData(parsed, filePath);

    return contractFileData.test.map((contract, index) =>
      this.validateContract(contract, index, filePath),
    );
  }

  /**
   * Validate contract data using type guard
   * @param contract - Contract data from JSON
   * @param index - Index of the contract in the array (for error reporting)
   * @param filePath - File path for error messages
   * @returns ContractInput - Validated contract
   * @throws Error if required fields are missing or invalid
   */
  private validateContract(
    contract: unknown,
    index: number,
    filePath: string,
  ): ContractInput {
    if (!this.isContractInput(contract)) {
      throw new Error(
        `Contract at index ${index} in ${filePath} is invalid or missing required fields (name, owner, address)`,
      );
    }

    return contract;
  }
}
