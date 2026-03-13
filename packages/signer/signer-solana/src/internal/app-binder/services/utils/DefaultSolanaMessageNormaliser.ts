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
    const { message } = await this.parser.parse(rawBytes);
    return message;
  }
}
