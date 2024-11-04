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

export type SendCommandInChunksTaskArgs<T> = {
  data: Uint8Array;
  commandFactory: CommandFactory<T>;
};

export type CommandFactory<T> = <V extends ChunkableCommandArgs>(
  args: ChunkableCommandArgs,
) => Command<T, V>;

export type ChunkableCommandArgs = {
  chunkedData: Uint8Array;
};

export class SendCommandInChunksTask<T> {
  constructor(
    private api: InternalApi,
    private args: SendCommandInChunksTaskArgs<T>,
  ) {}

  async run(): Promise<CommandResult<T, void>> {
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
