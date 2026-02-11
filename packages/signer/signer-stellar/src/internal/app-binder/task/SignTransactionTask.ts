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
  SignTransactionCommand,
  type SignTransactionCommandResponse,
} from "@internal/app-binder/command/SignTransactionCommand";
import { type StellarErrorCodes } from "@internal/app-binder/command/utils/stellarAppErrors";

type SignTransactionTaskArgs = {
  derivationPath: string;
  transaction: Uint8Array;
};

export class SignTransactionTask {
  constructor(
    private api: InternalApi,
    private args: SignTransactionTaskArgs,
  ) {}

  async run(): Promise<CommandResult<Signature, StellarErrorCodes>> {
    const { derivationPath, transaction } = this.args;
    const CHUNK_SIZE = SignTransactionCommand.CHUNK_SIZE;

    // Build path bytes
    const paths = DerivationPathUtils.splitPath(derivationPath);
    const pathData = new Uint8Array(1 + paths.length * 4);
    pathData[0] = paths.length;
    const pathDataView = new DataView(pathData.buffer);
    paths.forEach((element, index) => {
      pathDataView.setUint32(1 + index * 4, element, false);
    });

    // Combine path with transaction
    const payload = new Uint8Array(pathData.length + transaction.length);
    payload.set(pathData, 0);
    payload.set(transaction, pathData.length);

    // Split into chunks
    const chunks: Uint8Array[] = [];
    for (let i = 0; i < payload.length; i += CHUNK_SIZE) {
      const end = Math.min(i + CHUNK_SIZE, payload.length);
      chunks.push(payload.slice(i, end));
    }

    let lastResult: CommandResult<SignTransactionCommandResponse, StellarErrorCodes> | undefined;

    // Send each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const isFirstChunk = i === 0;
      const isLastChunk = i === chunks.length - 1;

      lastResult = await this.api.sendCommand(
        new SignTransactionCommand({
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

    const signature = lastResult.data.signature;
    if (!signature) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("No signature in response"),
      });
    }

    const signatureHex = Array.from(signature)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return CommandResultFactory({
      data: {
        r: signatureHex,
        s: "",
        v: undefined,
      },
    });
  }
}
