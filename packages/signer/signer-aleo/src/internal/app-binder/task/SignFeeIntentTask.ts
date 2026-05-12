import {
  ByteArrayBuilder,
  type CommandResult,
  type InternalApi,
} from "@ledgerhq/device-management-kit";

import {
  SignFeeIntentCommand,
  type SignFeeIntentCommandResponse,
} from "@internal/app-binder/command/SignFeeIntentCommand";
import { type AleoErrorCodes } from "@internal/app-binder/command/utils/aleoApplicationErrors";
import { APDU_SECTION_LENGTH } from "@internal/app-binder/command/utils/apduHeaderUtils";

import { SendAleoCommandInChunksTask } from "./SendAleoCommandInChunksTask";

export type SignFeeIntentTaskArgs = {
  feeIntent: Uint8Array;
};

export class SignFeeIntentTask {
  constructor(
    private api: InternalApi,
    private args: SignFeeIntentTaskArgs,
  ) {}

  async run(): Promise<
    CommandResult<SignFeeIntentCommandResponse, AleoErrorCodes>
  > {
    const { feeIntent } = this.args;

    // Data length (2 bytes) + Fee intent data
    const totalLength = APDU_SECTION_LENGTH.DATA_SIZE + feeIntent.byteLength;

    const builder = new ByteArrayBuilder(totalLength);

    // Add intent length
    builder.add16BitUIntToData(feeIntent.byteLength);

    // Add the fee intent data
    builder.addBufferToData(feeIntent);

    const fullPayload = builder.build();

    return new SendAleoCommandInChunksTask<SignFeeIntentCommandResponse>(
      this.api,
      {
        dataLength: feeIntent.byteLength,
        data: fullPayload,
        commandFactory: (chunkArgs) => new SignFeeIntentCommand(chunkArgs),
      },
    ).run();
  }
}
