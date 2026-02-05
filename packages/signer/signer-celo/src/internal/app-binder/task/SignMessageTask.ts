import {
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { DerivationPathUtils } from "@ledgerhq/signer-utils";

import { type Signature } from "@api/model/Signature";
import {
  SignMessageCommand,
  type SignMessageCommandResponse,
} from "@internal/app-binder/command/SignMessageCommand";
import { type CeloErrorCodes } from "@internal/app-binder/command/utils/celoAppErrors";

type SignMessageTaskArgs = {
  derivationPath: string;
  message: Uint8Array;
};

export class SignMessageTask {
  constructor(
    private api: InternalApi,
    private args: SignMessageTaskArgs,
  ) {}

  async run(): Promise<CommandResult<Signature, CeloErrorCodes>> {
    const { derivationPath, message } = this.args;
    const CHUNK_SIZE = SignMessageCommand.CHUNK_SIZE;

    // Build path bytes
    const paths = DerivationPathUtils.splitPath(derivationPath);
    const pathData = new Uint8Array(1 + paths.length * 4);
    pathData[0] = paths.length;
    const pathDataView = new DataView(pathData.buffer);
    paths.forEach((element, index) => {
      pathDataView.setUint32(1 + index * 4, element, false);
    });

    // First chunk: path + message length (4 bytes BE) + message start
    const messageLengthData = new Uint8Array(4);
    new DataView(messageLengthData.buffer).setUint32(0, message.length, false);

    const headerSize = pathData.length + messageLengthData.length;
    const firstChunkMsgSize = Math.min(CHUNK_SIZE - headerSize, message.length);
    const firstChunk = new Uint8Array(headerSize + firstChunkMsgSize);
    firstChunk.set(pathData, 0);
    firstChunk.set(messageLengthData, pathData.length);
    firstChunk.set(message.slice(0, firstChunkMsgSize), headerSize);

    let lastResult = await this.api.sendCommand(
      new SignMessageCommand({
        chunk: firstChunk,
        isFirstChunk: true,
      }),
    );

    if (!isSuccessCommandResult(lastResult)) {
      return lastResult;
    }

    // Send remaining chunks
    let offset = firstChunkMsgSize;
    while (offset < message.length) {
      const chunkSize = Math.min(CHUNK_SIZE, message.length - offset);
      const chunk = message.slice(offset, offset + chunkSize);

      lastResult = await this.api.sendCommand(
        new SignMessageCommand({
          chunk,
          isFirstChunk: false,
        }),
      );

      if (!isSuccessCommandResult(lastResult)) {
        return lastResult as CommandResult<Signature, CeloErrorCodes>;
      }

      offset += chunkSize;
    }

    const result = lastResult as CommandResult<SignMessageCommandResponse, CeloErrorCodes>;
    if (!isSuccessCommandResult(result) || result.data.v === undefined) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("No signature in response"),
      });
    }

    return CommandResultFactory({
      data: {
        r: result.data.r || "",
        s: result.data.s || "",
        v: result.data.v,
      },
    });
  }
}
