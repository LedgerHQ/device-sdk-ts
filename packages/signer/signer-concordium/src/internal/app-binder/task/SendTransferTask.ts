import {
  APDU_MAX_PAYLOAD,
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";
import {
  SignTransferCommand,
  type SignTransferCommandResponse,
} from "@internal/app-binder/command/SignTransferCommand";
import { type ConcordiumErrorCodes } from "@internal/app-binder/command/utils/ConcordiumApplicationErrors";
import { encodeDerivationPath } from "@internal/app-binder/command/utils/EncodeDerivationPath";
import { shouldUseFeeDisplay } from "@internal/app-binder/utils/FeeDisplaySupport";

type SendTransferTaskArgs = {
  derivationPath: string;
  transaction: Uint8Array;
  displayFeeMicroCcd?: bigint;
};

export class SendTransferTask {
  constructor(
    private readonly api: InternalApi,
    private readonly args: SendTransferTaskArgs,
    private readonly logger: LoggerPublisherService,
  ) {}

  async run(): Promise<
    CommandResult<SignTransferCommandResponse, ConcordiumErrorCodes>
  > {
    this.logger.debug("[run] Starting SendTransferTask", {
      data: {
        derivationPath: this.args.derivationPath,
        transactionLength: this.args.transaction.length,
      },
    });

    const { derivationPath, transaction, displayFeeMicroCcd } = this.args;
    const pathBytes = encodeDerivationPath(derivationPath);

    // Preflight version check: only pass the fee to the last chunk if the
    // device firmware accepts the P2=FEE_DISPLAY extension. Older firmwares
    // reject non-zero P2 bytes, so we silently fall back to the legacy path.
    const feeForLastChunk = (await shouldUseFeeDisplay(
      this.api,
      displayFeeMicroCcd,
    ))
      ? displayFeeMicroCcd
      : undefined;

    // Prepend derivation path to the transaction data so the first chunk
    // contains the path followed by as much transaction data as fits.
    const fullPayload = new Uint8Array(pathBytes.length + transaction.length);
    fullPayload.set(pathBytes, 0);
    fullPayload.set(transaction, pathBytes.length);

    for (
      let offset = 0;
      offset < fullPayload.length;
      offset += APDU_MAX_PAYLOAD
    ) {
      const isLastChunk = offset + APDU_MAX_PAYLOAD >= fullPayload.length;
      const chunkedData = fullPayload.slice(offset, offset + APDU_MAX_PAYLOAD);

      const result = await this.api.sendCommand(
        new SignTransferCommand({
          chunkedData,
          isLastChunk,
          // Only the last chunk carries the fee bytes; intermediate chunks
          // stay on the legacy path so P2 remains MORE (0x80).
          displayFeeMicroCcd: isLastChunk ? feeForLastChunk : undefined,
        }),
      );

      if (!isSuccessCommandResult(result)) {
        this.logger.debug("[run] Failed to send chunk", {
          data: {
            chunkNumber: Math.floor(offset / APDU_MAX_PAYLOAD),
            chunkOffset: offset,
            error: result.error,
          },
        });
        return result;
      }

      if (isLastChunk) {
        this.logger.debug("[run] All chunks sent successfully", {
          data: { signature: result.data },
        });
        return CommandResultFactory({
          data: result.data as Signature,
        });
      }
    }

    return CommandResultFactory({
      error: new InvalidStatusWordError("No signature returned"),
    });
  }
}
