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
import { type PolkadotErrorCodes } from "@internal/app-binder/command/utils/polkadotAppErrors";

type SignTransactionTaskArgs = {
  derivationPath: string;
  transaction: Uint8Array;
};

export class SignTransactionTask {
  constructor(
    private api: InternalApi,
    private args: SignTransactionTaskArgs,
  ) {}

  async run(): Promise<CommandResult<Signature, PolkadotErrorCodes>> {
    const { derivationPath, transaction } = this.args;
    const CHUNK_SIZE = SignTransactionCommand.CHUNK_SIZE;

    // Build path bytes (5 elements, little-endian)
    const paths = DerivationPathUtils.splitPath(derivationPath);
    const pathData = new Uint8Array(paths.length * 4);
    const pathView = new DataView(pathData.buffer);
    paths.forEach((element, index) => {
      pathView.setUint32(index * 4, element, true); // little-endian
    });

    // Combine path + transaction
    const fullPayload = new Uint8Array(pathData.length + transaction.length);
    fullPayload.set(pathData, 0);
    fullPayload.set(transaction, pathData.length);

    // Split into chunks
    const chunks: Uint8Array[] = [];
    for (let i = 0; i < fullPayload.length; i += CHUNK_SIZE) {
      chunks.push(fullPayload.slice(i, Math.min(i + CHUNK_SIZE, fullPayload.length)));
    }

    let lastResult: CommandResult<SignTransactionCommandResponse, PolkadotErrorCodes> | undefined;

    for (let i = 0; i < chunks.length; i++) {
      lastResult = await this.api.sendCommand(
        new SignTransactionCommand({
          data: chunks[i]!,
          chunkIndex: i,
          totalChunks: chunks.length,
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

    return CommandResultFactory({
      data: { r: signature, s: "", v: undefined },
    });
  }
}
