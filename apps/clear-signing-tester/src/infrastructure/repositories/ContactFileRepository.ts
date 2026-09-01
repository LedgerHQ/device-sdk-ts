import { inject, injectable } from "inversify";

import { TYPES } from "@root/src/di/types";
import { type FileReader } from "@root/src/domain/adapters/FileReader";
import { type JsonParser } from "@root/src/domain/adapters/JsonParser";
import { type ContactInput } from "@root/src/domain/models/ContactInput";

/** One entry of a contact case file, before validation. */
type RawContact = {
  description?: string;
  contactName?: string;
  scope?: string;
  address?: string;
  // JSON has no bigint, so chain ids arrive as a decimal string or a number.
  chainId?: string | number;
  expectedTexts?: string[];
  unexpectedTexts?: string[];
};

@injectable()
export class ContactFileRepository {
  constructor(
    @inject(TYPES.FileReader)
    private readonly fileReader: FileReader,
    @inject(TYPES.JsonParser)
    private readonly jsonParser: JsonParser,
  ) {}

  readFromFile(filePath: string): ContactInput[] {
    const raw = this.jsonParser.parse<RawContact[]>(
      this.fileReader.readFileSync(filePath),
    );

    if (!Array.isArray(raw)) {
      throw new Error(
        `Invalid file format: expected an array of contacts in ${filePath}`,
      );
    }

    return raw.map((entry, index) => this.mapToContact(entry, index));
  }

  private mapToContact(raw: RawContact, index: number): ContactInput {
    const { contactName, scope, address, chainId } = raw;

    if (!contactName || !scope || !address || chainId === undefined) {
      throw new Error(
        `Contact at index ${index} is missing one of 'contactName', 'scope', 'address', 'chainId'`,
      );
    }

    if (!/^0x[0-9a-fA-F]{40}$/.test(address)) {
      throw new Error(`Contact at index ${index} has an invalid 'address'`);
    }

    return {
      description: raw.description || `Contact ${index + 1}`,
      contactName,
      scope,
      address: address as `0x${string}`,
      chainId: BigInt(chainId),
      expectedTexts: raw.expectedTexts,
      unexpectedTexts: raw.unexpectedTexts,
    };
  }
}
