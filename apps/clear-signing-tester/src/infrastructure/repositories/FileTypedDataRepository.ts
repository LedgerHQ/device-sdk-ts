import { inject, injectable } from "inversify";
import { TypedDataInput } from "@root/src/domain/models/TypedDataInput";
import { TypedDataFileRepository } from "@root/src/domain/repositories/TypedDataFileRepository";
import { NodeFileReader } from "@root/src/infrastructure/adapters/NodeFileReader";
import { TYPES } from "@root/src/di/types";
import { TypedData } from "@ledgerhq/device-signer-kit-ethereum";

/**
 * Raw typed data structure from JSON file
 */
interface RawTypedDataData {
    data: TypedData;
    description?: string;
    expectedTexts?: string[];
}

/**
 * File-based implementation of TypedDataFileRepository
 * Reads typed data from JSON files using NodeFileReader
 */
@injectable()
export class FileTypedDataRepository implements TypedDataFileRepository {
    constructor(
        @inject(TYPES.NodeFileReader)
        private readonly fileReader: NodeFileReader,
    ) {}

    /**
     * Read and parse typed data from a JSON file
     * @param filePath - Path to the JSON file containing typed data
     * @returns Promise<InternalTypedData[]> - Array of parsed InternalTypedData objects
     * @throws Error if file doesn't exist, is not readable, or contains invalid data
     */
    async readTypedDataFromFile(filePath: string): Promise<TypedDataInput[]> {
        const fileContent = this.fileReader.readFileSync(filePath);

        const rawTypedDataArray =
            this.fileReader.parseJson<RawTypedDataData[]>(fileContent);

        if (!Array.isArray(rawTypedDataArray)) {
            throw new Error(
                `Invalid file format: expected an array of typed data in ${filePath}`,
            );
        }

        return rawTypedDataArray.map((rawTypedData, index) =>
            this.mapToInternalTypedData(rawTypedData, index),
        );
    }

    /**
     * Map raw typed data to InternalTypedData domain model
     * @param rawTypedData - Raw typed data from JSON
     * @param index - Index of the typed data in the array (for error reporting)
     * @returns InternalTypedData - Domain model typed data
     * @throws Error if required fields are missing
     */
    private mapToInternalTypedData(
        rawTypedData: RawTypedDataData,
        index: number,
    ): TypedDataInput {
        if (!rawTypedData.data) {
            throw new Error(
                `Typed data at index ${index} is missing required field 'data'`,
            );
        }

        return {
            data: JSON.stringify(rawTypedData.data),
            description: rawTypedData.description || `Typed data ${index + 1}`,
            expectedTexts: rawTypedData.expectedTexts,
        };
    }
}
