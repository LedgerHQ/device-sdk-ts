import type { NormalizedMessage } from "@internal/app-binder/services/TransactionInspector";
import { TransactionInspector } from "@internal/app-binder/services/TransactionInspector";

export interface SolanaMessageNormaliserConstructor {
  normaliseMessage(rawBytes: Uint8Array): Promise<NormalizedMessage>;
}

export class DefaultSolanaMessageNormaliser {
  static async normaliseMessage(
    rawBytes: Uint8Array,
  ): Promise<NormalizedMessage> {
    return TransactionInspector.normaliseMessage(rawBytes);
  }
}
