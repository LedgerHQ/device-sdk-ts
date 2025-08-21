import { type CryptoService } from "@api/crypto/CryptoService";
import { type KeyPair } from "@api/crypto/KeyPair";
import { LKRPUnknownError } from "@api/model/Errors";
import { type LKRPBlockStream } from "@internal/utils/LKRPBlockStream";

export class ExtractEncryptionKeyTask {
  async run(
    cryptoService: CryptoService,
    keypair: KeyPair,
    stream: LKRPBlockStream,
  ) {
    // TODO additional derivations should be supported:
    // https://github.com/LedgerHQ/ledger-live/blob/develop/libs/hw-ledger-key-ring-protocol/src/Device.ts#L216...L226
    // Probably not needed for Ledger Sync
    return (await stream.getPublishedKey(cryptoService, keypair))
      .map((key) => key.privateKey)
      .toEither(
        new LKRPUnknownError(
          "There is no encryption key for the current member in the application stream.",
        ),
      );
  }
}
