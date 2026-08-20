import {
  APDU_MAX_PAYLOAD,
  type CommandResult,
  DmkResultFactory,
  type InternalApi,
  InvalidArgumentError,
  InvalidStatusWordError,
  isSuccessCommandResult,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";

import {
  SignPhase,
  SignTransactionCommand,
  type SignTransactionCommandResponse,
} from "@internal/app-binder/command/SignTransactionCommand";
import { type PolkadotErrorCodes } from "@internal/app-binder/command/utils/polkadotApplicationErrors";

type SignTransactionTaskArgs = {
  derivationPath: string;
  blob: Uint8Array;
  metadata: Uint8Array;
};

export class SignTransactionTask {
  constructor(
    private api: InternalApi,
    private args: SignTransactionTaskArgs,
    private logger: LoggerPublisherService,
  ) {}

  async run(): Promise<
    CommandResult<SignTransactionCommandResponse, PolkadotErrorCodes>
  > {
    const { derivationPath, blob, metadata } = this.args;
    const blobLength = blob.length;

    // An empty blob has nothing to sign: the device would refuse it anyway, and
    // sending INIT alone would leave a transaction open on it.
    if (blobLength === 0) {
      return DmkResultFactory({
        error: new InvalidArgumentError(
          "Cannot sign an empty transaction blob",
        ),
      });
    }

    // Concatenate blob + metadata into the full payload
    const payload = new Uint8Array(blob.length + metadata.length);
    payload.set(blob, 0);
    payload.set(metadata, blob.length);

    this.logger.debug("[run] Starting SignTransactionTask", {
      data: {
        derivationPath,
        blobLength,
        metadataLength: metadata.length,
        payloadLength: payload.length,
      },
    });

    // Send INIT command with derivation path and blobLength
    const initResult = await this.api.sendCommand(
      new SignTransactionCommand({
        phase: SignPhase.INIT,
        derivationPath,
        blobLength,
      }),
    );

    if (!isSuccessCommandResult(initResult)) {
      this.logger.debug("[run] Failed to sign transaction", {
        data: { error: initResult.error },
      });
      return initResult;
    }

    // Loop through payload in APDU_MAX_PAYLOAD chunks
    for (let offset = 0; offset < payload.length; offset += APDU_MAX_PAYLOAD) {
      const isLastChunk = offset + APDU_MAX_PAYLOAD >= payload.length;
      const phase = isLastChunk ? SignPhase.LAST : SignPhase.ADD;
      const transactionChunk = payload.slice(offset, offset + APDU_MAX_PAYLOAD);

      const result = await this.api.sendCommand(
        new SignTransactionCommand({
          phase,
          transactionChunk,
        }),
      );

      if (!isSuccessCommandResult(result)) {
        this.logger.debug("[run] Failed to sign transaction", {
          data: {
            chunkIndex: offset,
            error: result.error,
          },
        });
        return result;
      }

      if (isLastChunk) {
        this.logger.debug("[run] Transaction signed successfully", {
          data: {
            signature: result.data,
          },
        });
        return result;
      }
    }

    return DmkResultFactory({
      error: new InvalidStatusWordError("No signature returned"),
    });
  }
}
