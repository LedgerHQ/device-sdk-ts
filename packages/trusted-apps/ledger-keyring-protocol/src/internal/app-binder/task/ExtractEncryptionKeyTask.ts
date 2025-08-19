import { type Keypair } from "@api/index";
import { LKRPUnknownError } from "@api/model/Errors";
import { type LKRPBlockStream } from "@internal/utils/LKRPBlockStream";

export type ExtractEncryptionKeyTaskInput = {
  applicationStream: LKRPBlockStream;
  keypair: Keypair;
};

export class ExtractEncryptionKeyTask {
  async run(keypair: Keypair, stream: LKRPBlockStream) {
    // TODO additional derivations should be supported:
    // https://github.com/LedgerHQ/ledger-live/blob/develop/libs/hw-ledger-key-ring-protocol/src/Device.ts#L216...L226
    // Probably not needed for Ledger Sync
    return Promise.resolve(
      stream
        .getPublishedKey(keypair)
        .map((key) => key.privateKey)
        .toEither(
          new LKRPUnknownError(
            "There is no encryption key for the current member in the application stream.",
          ),
        ),
    );
  }
}
