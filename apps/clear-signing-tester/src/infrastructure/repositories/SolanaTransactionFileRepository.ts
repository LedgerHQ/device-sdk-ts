import { inject, injectable } from "inversify";

import { TYPES } from "@root/src/di/types";
import { type FileReader } from "@root/src/domain/adapters/FileReader";
import { type JsonParser } from "@root/src/domain/adapters/JsonParser";
import { SignableInputKind } from "@root/src/domain/models/SignableInputKind";
import { type TransactionInput } from "@root/src/domain/models/TransactionInput";
import { type DataFileRepository } from "@root/src/domain/repositories/DataFileRepository";

type RawTransactionData = {
  rawTx: string;
  description?: string;
  expectedTexts?: string[];
};

@injectable()
export class SolanaTransactionFileRepository
  implements DataFileRepository<TransactionInput>
{
  constructor(
    @inject(TYPES.FileReader)
    private readonly fileReader: FileReader,
    @inject(TYPES.JsonParser)
    private readonly jsonParser: JsonParser,
  ) {}

  readFromFile(filePath: string): TransactionInput[] {
    const fileContent = this.fileReader.readFileSync(filePath);

    const rawTransactions =
      this.jsonParser.parse<RawTransactionData[]>(fileContent);

    if (!Array.isArray(rawTransactions)) {
      throw new Error(
        `Invalid file format: expected an array of transactions in ${filePath}`,
      );
    }

    return rawTransactions.map((rawTx, index) => {
      if (!rawTx.rawTx) {
        throw new Error(
          `Transaction at index ${index} is missing required field 'rawTx'`,
        );
      }

      return {
        kind: SignableInputKind.Transaction,
        rawTx: rawTx.rawTx,
        description: rawTx.description || `Transaction ${index + 1}`,
        expectedTexts: rawTx.expectedTexts,
      };
    });
  }
}
