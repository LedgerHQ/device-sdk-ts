import { inject, injectable } from "inversify";

import { TYPES } from "@root/src/di/types";
import { type FileReader } from "@root/src/domain/adapters/FileReader";
import { type JsonParser } from "@root/src/domain/adapters/JsonParser";
import { type SafeAddressInput } from "@root/src/domain/models/SafeAddressInput";
import { scenarioCases } from "@root/src/infrastructure/repositories/scenarioCases";

/** One entry of a Safe address case file, before validation. */
type RawSafeAddress = {
  description?: string;
  safeContractAddress?: string;
  chainId?: number;
  expectedTexts?: string[];
  unexpectedTexts?: string[];
};

@injectable()
export class SafeAddressFileRepository {
  constructor(
    @inject(TYPES.FileReader)
    private readonly fileReader: FileReader,
    @inject(TYPES.JsonParser)
    private readonly jsonParser: JsonParser,
  ) {}

  readFromFile(filePath: string): SafeAddressInput[] {
    const raw = scenarioCases<RawSafeAddress>(
      this.jsonParser.parse<unknown>(this.fileReader.readFileSync(filePath)),
      filePath,
    );

    return raw.map((entry, index) => {
      const { safeContractAddress, chainId } = entry;
      if (
        !safeContractAddress ||
        !/^0x[0-9a-fA-F]{40}$/.test(safeContractAddress) ||
        typeof chainId !== "number"
      ) {
        throw new Error(
          `Safe address at index ${index} needs a hex 'safeContractAddress' and a numeric 'chainId'`,
        );
      }
      return {
        description: entry.description || `Safe address ${index + 1}`,
        safeContractAddress,
        chainId,
        expectedTexts: entry.expectedTexts,
        unexpectedTexts: entry.unexpectedTexts,
      };
    });
  }
}
