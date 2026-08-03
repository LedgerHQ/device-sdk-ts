import {
  APDU_MAX_PAYLOAD,
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { type Maybe, Nothing } from "purify-ts";

import {
  type DeviceUpdateCallSignature,
  type UpdateCallSignature,
} from "@api/model/UpdateCallSignature";
import { SignUpdateCallCommand } from "@internal/app-binder/command/SignUpdateCallCommand";
import { type IcpErrorCodes } from "@internal/app-binder/command/utils/IcpApplicationErrors";
import { SignPhase } from "@internal/app-binder/constants";

// Length prefix carried before each of the two envelopes in the combined
// message (little-endian uint32).
const LENGTH_PREFIX_SIZE = 4;

type SignUpdateCallTaskArgs = {
  derivationPath: string;
  // The IC update call to sign.
  callRequest: Uint8Array;
  // The companion read-state request signed alongside the call.
  readStateRequest: Uint8Array;
};

export class SignUpdateCallTask {
  constructor(
    private api: InternalApi,
    private args: SignUpdateCallTaskArgs,
    private logger: LoggerPublisherService,
  ) {}

  // Combined-sign message: [u32LE readStateLen][readState][u32LE callLen][call].
  // The device parses the read-state envelope first, then the call.
  private buildCombinedMessage(): Uint8Array {
    const { callRequest, readStateRequest } = this.args;
    const message = new Uint8Array(
      2 * LENGTH_PREFIX_SIZE + readStateRequest.length + callRequest.length,
    );
    const view = new DataView(message.buffer);

    view.setUint32(0, readStateRequest.length, true);
    message.set(readStateRequest, LENGTH_PREFIX_SIZE);

    const callLenOffset = LENGTH_PREFIX_SIZE + readStateRequest.length;
    view.setUint32(callLenOffset, callRequest.length, true);
    message.set(callRequest, callLenOffset + LENGTH_PREFIX_SIZE);

    return message;
  }

  async run(): Promise<CommandResult<UpdateCallSignature, IcpErrorCodes>> {
    const { derivationPath, callRequest, readStateRequest } = this.args;

    this.logger.debug("[run] Starting SignUpdateCallTask", {
      data: {
        derivationPath,
        callRequestLength: callRequest.length,
        readStateRequestLength: readStateRequest.length,
      },
    });

    if (callRequest.length === 0 || readStateRequest.length === 0) {
      // A missing envelope would break the device's request ↔ read-state check.
      return CommandResultFactory({
        error: new InvalidStatusWordError(
          "Both call and read-state requests are required",
        ),
      });
    }

    const message = this.buildCombinedMessage();

    const initResult = await this.api.sendCommand(
      new SignUpdateCallCommand({
        phase: SignPhase.INIT,
        derivationPath,
      }),
    );

    if (!isSuccessCommandResult(initResult)) {
      this.logger.debug("[run] Failed to initialize signing", {
        data: { error: initResult.error },
      });
      return initResult;
    }

    let signature: Maybe<DeviceUpdateCallSignature> = Nothing;
    for (let offset = 0; offset < message.length; offset += APDU_MAX_PAYLOAD) {
      const isLastChunk = offset + APDU_MAX_PAYLOAD >= message.length;
      const phase = isLastChunk ? SignPhase.LAST : SignPhase.ADD;
      const transactionChunk = message.slice(offset, offset + APDU_MAX_PAYLOAD);

      const result = await this.api.sendCommand(
        new SignUpdateCallCommand({ phase, transactionChunk }),
      );

      if (!isSuccessCommandResult(result)) {
        this.logger.debug("[run] Failed to sign update-call chunk", {
          data: { chunkOffset: offset, error: result.error },
        });
        return result;
      }

      signature = result.data;
    }

    return signature.mapOrDefault(
      (data) => {
        this.logger.debug("[run] Update call signed successfully");
        return CommandResultFactory<UpdateCallSignature, IcpErrorCodes>({
          data: { ...data, readStateBody: readStateRequest },
        });
      },
      CommandResultFactory({
        error: new InvalidStatusWordError("No signature returned"),
      }),
    );
  }
}
