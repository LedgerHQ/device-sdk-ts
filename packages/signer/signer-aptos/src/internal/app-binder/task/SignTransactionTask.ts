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
import { type AptosErrorCodes } from "@internal/app-binder/command/utils/aptosAppErrors";

type SignTransactionTaskArgs = {
  derivationPath: string;
  transaction: Uint8Array;
};

export class SignTransactionTask {
  constructor(
    private api: InternalApi,
    private args: SignTransactionTaskArgs,
  ) {}

  async run(): Promise<CommandResult<Signature, AptosErrorCodes>> {
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

    // First chunk: send path
    let result = await this.api.sendCommand(
      new SignTransactionCommand({
        chunk: pathData,
        chunkIndex: 0,
        isLastChunk: false,
      }),
    );

    if (!isSuccessCommandResult(result)) {
      return result;
    }

    // Send transaction in chunks
    const chunks: Uint8Array[] = [];
    for (let i = 0; i < transaction.length; i += CHUNK_SIZE) {
      chunks.push(transaction.slice(i, Math.min(i + CHUNK_SIZE, transaction.length)));
    }

    let lastResult: CommandResult<SignTransactionCommandResponse, AptosErrorCodes> = result;

    for (let i = 0; i < chunks.length; i++) {
      const isLastChunk = i === chunks.length - 1;

      lastResult = await this.api.sendCommand(
        new SignTransactionCommand({
          chunk: chunks[i]!,
          chunkIndex: i + 1,
          isLastChunk,
        }),
      );

      if (!isSuccessCommandResult(lastResult)) {
        return lastResult;
      }
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
      data: { r: signatureHex, s: "", v: undefined },
    });
  }
}
