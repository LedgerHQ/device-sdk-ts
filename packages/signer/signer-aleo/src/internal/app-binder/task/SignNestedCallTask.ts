import {
  ByteArrayBuilder,
  type CommandResult,
  type InternalApi,
} from "@ledgerhq/device-management-kit";

import {
  SignNestedCallCommand,
  type SignNestedCallCommandResponse,
} from "@internal/app-binder/command/SignNestedCallCommand";
import { type AleoErrorCodes } from "@internal/app-binder/command/utils/aleoApplicationErrors";

import { SendAleoCommandInChunksTask } from "./SendAleoCommandInChunksTask";

export type SignNestedCallTaskArgs = {
  nestedCallRequest: Uint8Array;
};

export class SignNestedCallTask {
  constructor(
    private readonly api: InternalApi,
    private readonly args: SignNestedCallTaskArgs,
  ) {}

  async run(): Promise<
    CommandResult<SignNestedCallCommandResponse, AleoErrorCodes>
  > {
    const { nestedCallRequest } = this.args;

    // Data length (2 bytes) + nested call request data
    const totalLength = 2 + nestedCallRequest.byteLength;

    const builder = new ByteArrayBuilder(totalLength);

    builder.add16BitUIntToData(nestedCallRequest.byteLength);

    builder.addBufferToData(nestedCallRequest);

    const fullPayload = builder.build();

    return new SendAleoCommandInChunksTask<SignNestedCallCommandResponse>(
      this.api,
      {
        dataLength: nestedCallRequest.byteLength,
        data: fullPayload,
        commandFactory: (chunkArgs) => new SignNestedCallCommand(chunkArgs),
      },
    ).run();
  }
}
