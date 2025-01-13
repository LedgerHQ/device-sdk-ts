import {
  APDU_MAX_PAYLOAD,
  type Command,
  CommandResultFactory,
  type InternalApi,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { type Maybe, Nothing } from "purify-ts";

export type SignCommandArgs = {
  data: Uint8Array;
  isLastChunk: boolean;
};

export class SignUtils {
  constructor(
    private readonly api: InternalApi,
    private readonly chunkSize: number = APDU_MAX_PAYLOAD,
  ) {}
  async signInChunks<CommandResponse, CommandErrorCodes>(
    command: {
      new (
        args: SignCommandArgs,
      ): Command<CommandResponse, SignCommandArgs, CommandErrorCodes>;
    },
    buffer: Uint8Array,
  ) {
    let result = CommandResultFactory<
      CommandResponse | Maybe<never>,
      CommandErrorCodes
    >({
      data: Nothing,
    });

    for (let i = 0; i < buffer.length; i += this.chunkSize) {
      result = await this.api.sendCommand(
        new command({
          data: buffer.slice(i, i + this.chunkSize),
          isLastChunk: i + this.chunkSize >= buffer.length,
        }),
      );

      if (!isSuccessCommandResult(result)) {
        return result;
      }
    }
    return result;
  }
}
