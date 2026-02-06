import type { NormalizedMessage } from "@internal/app-binder/services/TransactionInspector";

import { TransactionParser } from "./TransactionParser";

export interface SolanaMessageNormaliserConstructor {
  normaliseMessage(rawBytes: Uint8Array): Promise<NormalizedMessage>;
}

export class DefaultSolanaMessageNormaliser {
  static async normaliseMessage(
    rawBytes: Uint8Array,
  ): Promise<NormalizedMessage> {
    // Parse without an ALT resolver (same as the original static call).
    const parser = new TransactionParser();
    const { message } = await parser.parse(rawBytes);
    return message;
  }
}
