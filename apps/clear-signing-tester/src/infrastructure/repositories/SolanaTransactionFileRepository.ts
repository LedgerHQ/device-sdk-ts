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
  expectBlindSigned?: boolean;
  skipCraft?: boolean;
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
        // A descriptor the device could not resolve (token, ALT, trusted name)
        // degrades to the raw account and the unscaled amount, which still
        // signs. Asserting the absence of a spoofed symbol/name/amount is what
        // makes a case fail when clear signing is subverted rather than broken.
        unexpectedTexts: rawTx.unexpectedTexts,
        // A case whose point is that the transaction cannot be clear-signed
        // passes on blind_signed and fails if it ever clear-signs or errors.
        expectBlindSigned: rawTx.expectBlindSigned,
        // Solana-only: leave the payer key as authored instead of rewriting it
        // to the device key before signing (for cases whose signer matters).
        skipCraft: rawTx.skipCraft,
      };
    });
  }
}
