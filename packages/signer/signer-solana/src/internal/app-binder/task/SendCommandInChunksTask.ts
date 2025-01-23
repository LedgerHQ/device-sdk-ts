import {
  APDU_MAX_PAYLOAD,
  ByteArrayBuilder,
  type Command,
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { type SolanaAppErrorCodes } from "@internal/app-binder/command/utils/SolanaApplicationErrors";

export type SendCommandInChunksTaskArgs<T> = {
  data: Uint8Array;
  commandFactory: CommandFactory<T>;
};

export type CommandFactory<T> = <V extends ChunkableCommandArgs>(
  args: ChunkableCommandArgs,
) => Command<T, V, SolanaAppErrorCodes>;

export type ChunkableCommandArgs = {
  chunkedData: Uint8Array;
  more: boolean;
  extend: boolean;
};

export class SendCommandInChunksTask<T> {
  constructor(
    private api: InternalApi,
    private args: SendCommandInChunksTaskArgs<T>,
  ) {}

  async run(): Promise<CommandResult<T, SolanaAppErrorCodes>> {
    const { data: fullPayload, commandFactory } = this.args;

    const dataBuffer = new ByteArrayBuilder(fullPayload.length)
      .addBufferToData(fullPayload)
      .build();

    for (
      let offset = 0;
      offset < dataBuffer.length;
      offset += APDU_MAX_PAYLOAD
    ) {
      const isLastChunk = offset + APDU_MAX_PAYLOAD >= dataBuffer.length;
      const result = await this.api.sendCommand(
        commandFactory({
          more: !isLastChunk,
          extend: offset > 0,
          chunkedData: dataBuffer.slice(offset, offset + APDU_MAX_PAYLOAD),
        }),
      );

      if (!isSuccessCommandResult(result)) {
        return result;
      }

      if (isLastChunk) {
        return CommandResultFactory({
          data: result.data,
        });
      }
    }

    throw new InvalidStatusWordError("No result after processing all chunks");
  }
}
