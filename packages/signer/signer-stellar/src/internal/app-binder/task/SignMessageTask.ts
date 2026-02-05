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
import { type StellarErrorCodes } from "@internal/app-binder/command/utils/stellarAppErrors";

type SignMessageTaskArgs = {
  derivationPath: string;
  message: string | Uint8Array;
};

export class SignMessageTask {
  constructor(
    private api: InternalApi,
    private args: SignMessageTaskArgs,
  ) {}

  async run(): Promise<CommandResult<Signature, StellarErrorCodes>> {
    const { derivationPath, message } = this.args;
    const CHUNK_SIZE = SignMessageCommand.CHUNK_SIZE;

    // Convert message to Uint8Array if string
    const messageBytes = typeof message === "string"
      ? new Uint8Array(Buffer.from(message, "hex"))
      : message;

    // Build path bytes
    const paths = DerivationPathUtils.splitPath(derivationPath);
    const pathData = new Uint8Array(1 + paths.length * 4);
    pathData[0] = paths.length;
    const pathDataView = new DataView(pathData.buffer);
    paths.forEach((element, index) => {
      pathDataView.setUint32(1 + index * 4, element, false);
    });

    // Combine path with message
    const payload = new Uint8Array(pathData.length + messageBytes.length);
    payload.set(pathData, 0);
    payload.set(messageBytes, pathData.length);

    // Split into chunks
    const chunks: Uint8Array[] = [];
    for (let i = 0; i < payload.length; i += CHUNK_SIZE) {
      const end = Math.min(i + CHUNK_SIZE, payload.length);
      chunks.push(payload.slice(i, end));
    }

    let lastResult: CommandResult<SignMessageCommandResponse, StellarErrorCodes> | undefined;

    // Send each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const isFirstChunk = i === 0;
      const isLastChunk = i === chunks.length - 1;

      lastResult = await this.api.sendCommand(
        new SignMessageCommand({
          chunk: chunk!,
          isFirstChunk,
          isLastChunk,
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

    // SignMessageCommand already returns the signature in correct format
    return CommandResultFactory({
      data: lastResult.data,
    });
  }
}
