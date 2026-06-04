import type { NormalizedMessage } from "@internal/app-binder/services/TransactionInspector";

import { TransactionParser } from "./TransactionParser";

export interface SolanaMessageNormaliser {
  normaliseMessage(rawBytes: Uint8Array): Promise<NormalizedMessage>;
}

export class DefaultSolanaMessageNormaliser implements SolanaMessageNormaliser {
  constructor(
    private readonly parser: TransactionParser = new TransactionParser(),
  ) {}

  async normaliseMessage(rawBytes: Uint8Array): Promise<NormalizedMessage> {
    const parsed = await this.parser.parse(rawBytes).run();
    return parsed.caseOf({
      Left: (err) => {
        throw err.originalError ?? new Error(err._tag);
      },
      Right: ({ message }) => message,
    });
  }
}
