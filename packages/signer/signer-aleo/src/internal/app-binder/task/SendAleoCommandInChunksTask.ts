import {
  APDU_MAX_PAYLOAD,
  type CommandResult,
  type InternalApi,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { type AleoErrorCodes } from "@internal/app-binder/command/utils/aleoApplicationErrors";

import { type AleoCommandFactory } from "./AleoChunkableCommandArgs";

export type SendAleoCommandInChunksTaskArgs<T> = {
  dataLength: number;
  data: Uint8Array;
  derivationPath?: string;
  commandFactory: AleoCommandFactory<T>;
};

export class SendAleoCommandInChunksTask<T> {
  constructor(
    private api: InternalApi,
    private args: SendAleoCommandInChunksTaskArgs<T>,
  ) {}

  async run(): Promise<CommandResult<T, AleoErrorCodes>> {
    const { dataLength, data, derivationPath, commandFactory } = this.args;
    let result: CommandResult<T, AleoErrorCodes> | undefined;

    for (let i = 0; i < data.length; i += APDU_MAX_PAYLOAD) {
      const isFirst = i === 0;
      const chunk = data.slice(i, i + APDU_MAX_PAYLOAD);

      result = await this.api.sendCommand(
        commandFactory({
          dataLength,
          chunkedData: chunk,
          isFirst,
          derivationPath: isFirst ? derivationPath : undefined,
        }),
      );

      if (!isSuccessCommandResult(result)) {
        return result;
      }
    }

    if (!result) {
      // Should not happen if data.length > 0
      throw new Error("No data to send in chunks");
    }

    return result;
  }
}
