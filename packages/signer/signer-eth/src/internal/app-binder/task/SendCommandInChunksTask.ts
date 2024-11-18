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
  commandFactory: <V extends ChunkableCommandArgs & Record<string, unknown>>(
    args: ChunkableCommandArgs,
  ) => Command<T, V>;
};

export type ChunkableCommandArgs = {
  chunkedData: Uint8Array;
  isFirstChunk: boolean;
};

export class SendCommandInChunksTask<T> {
  constructor(
    private api: InternalApi,
    private args: SendCommandInChunksTaskArgs<T>,
  ) {}

  async run(): Promise<CommandResult<T, void>> {
    const { data: payload, commandFactory } = this.args;

    const data = new ByteArrayBuilder(payload.length)
      .addBufferToData(payload)
      .build();

    for (let i = 0; i < data.length; i += APDU_MAX_PAYLOAD) {
      const isLastChunk = i + APDU_MAX_PAYLOAD >= data.length;
      const result = await this.api.sendCommand(
        commandFactory({
          chunkedData: data.slice(i, i + APDU_MAX_PAYLOAD),
          isFirstChunk: i === 0,
        }),
      );

      if (!isSuccessCommandResult(result)) {
        return result;
      }

      // return the last result
      if (isLastChunk) {
        return CommandResultFactory({
          data: result.data,
        });
      }
    }

    throw new InvalidStatusWordError("No result");
  }
}
