import { inject, injectable } from "inversify";

import { TYPES } from "@root/src/di/types";
import { type FileReader } from "@root/src/domain/adapters/FileReader";
import { type JsonParser } from "@root/src/domain/adapters/JsonParser";
import { SignableInputKind } from "@root/src/domain/models/SignableInputKind";
import { type TransactionInput } from "@root/src/domain/models/TransactionInput";
import { type DataFileRepository } from "@root/src/domain/repositories/DataFileRepository";
import { scenarioCases } from "@root/src/infrastructure/repositories/scenarioCases";

type RawTransactionData = {
  transaction?: unknown;
  description?: string;
  expectedTexts?: string[];
  unexpectedTexts?: string[];
};

/**
 * Reads legacy Bitcoin cases, whose `transaction` is hw-app-btc's
 * `createPaymentTransaction` argument with hex strings for its bytes.
 *
 * The legacy protocol has no single serialised transaction to sign: the device
 * takes each previous transaction, the input paths and the outputs on their
 * own. So `rawTx` carries that argument as JSON, which
 * {@link BtcLegacySigningService} decodes back into the signer's.
 */
@injectable()
export class BtcLegacyTransactionFileRepository
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
      if (!rawTx.transaction) {
        throw new Error(
          `Transaction at index ${index} is missing required field 'transaction'`,
        );
      }

      return {
        kind: SignableInputKind.Transaction,
        rawTx: JSON.stringify(rawTx.transaction),
        description: rawTx.description || `Transaction ${index + 1}`,
        expectedTexts: rawTx.expectedTexts,
        unexpectedTexts: rawTx.unexpectedTexts,
      };
    });
  }
}
