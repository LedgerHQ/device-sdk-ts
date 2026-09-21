import { inject, injectable } from "inversify";

import { TYPES } from "@root/src/di/types";
import { type FileReader } from "@root/src/domain/adapters/FileReader";
import { type JsonParser } from "@root/src/domain/adapters/JsonParser";
import { SignableInputKind } from "@root/src/domain/models/SignableInputKind";
import { type TransactionInput } from "@root/src/domain/models/TransactionInput";
import { type DataFileRepository } from "@root/src/domain/repositories/DataFileRepository";
import { scenarioCases } from "@root/src/infrastructure/repositories/scenarioCases";

type RawTransactionData = {
  rawTx: string;
  description?: string;
  expectedTexts?: string[];
  unexpectedTexts?: string[];
};

/**
 * Reads Tron cases, whose `rawTx` is the hex-encoded protobuf `raw_data` the
 * signer takes as-is: there is no payer to substitute and no signature to
 * strip, so nothing is crafted on the way through.
 */
@injectable()
export class TronTransactionFileRepository
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

    const rawTransactions = scenarioCases<RawTransactionData>(
      this.jsonParser.parse<unknown>(fileContent),
      filePath,
    );

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
        // A token name the device could not resolve degrades to the raw asset
        // id and the unscaled amount, which still signs. Asserting the absence
        // of those is what makes a case fail when clear signing breaks.
        unexpectedTexts: rawTx.unexpectedTexts,
      };
    });
  }
}
