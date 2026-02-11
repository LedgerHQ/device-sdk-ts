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
import { type MultiversxErrorCodes } from "@internal/app-binder/command/utils/multiversxAppErrors";

type SignMessageTaskArgs = {
  derivationPath: string;
  message: Uint8Array;
};

export class SignMessageTask {
  constructor(
    private api: InternalApi,
    private args: SignMessageTaskArgs,
  ) {}

  async run(): Promise<CommandResult<Signature, MultiversxErrorCodes>> {
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

    // Combine path + message length (4 bytes BE) + message
    const messageLengthData = new Uint8Array(4);
    new DataView(messageLengthData.buffer).setUint32(0, message.length, false);

    const fullPayload = new Uint8Array(pathData.length + messageLengthData.length + message.length);
    fullPayload.set(pathData, 0);
    fullPayload.set(messageLengthData, pathData.length);
    fullPayload.set(message, pathData.length + messageLengthData.length);

    // Split into chunks
    const chunks: Uint8Array[] = [];
    for (let i = 0; i < fullPayload.length; i += CHUNK_SIZE) {
      chunks.push(fullPayload.slice(i, Math.min(i + CHUNK_SIZE, fullPayload.length)));
    }

    let lastResult: CommandResult<SignMessageCommandResponse, MultiversxErrorCodes> | undefined;

    for (let i = 0; i < chunks.length; i++) {
      const isFirstChunk = i === 0;

      lastResult = await this.api.sendCommand(
        new SignMessageCommand({
          data: chunks[i]!,
          isFirstChunk,
        }),
      );

      if (!isSuccessCommandResult(lastResult)) {
        return lastResult;
      }
    }

    if (!lastResult) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("No response received"),
      });
    }

    if (!isSuccessCommandResult(lastResult)) {
      return lastResult;
    }

    return lastResult;
  }
}
