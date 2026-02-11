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
import { type MultiversxErrorCodes } from "@internal/app-binder/command/utils/multiversxAppErrors";

type SignTransactionTaskArgs = {
  derivationPath: string;
  transaction: Uint8Array;
};

export class SignTransactionTask {
  constructor(
    private api: InternalApi,
    private args: SignTransactionTaskArgs,
  ) {}

  async run(): Promise<CommandResult<Signature, MultiversxErrorCodes>> {
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

    // Combine path + transaction
    const fullPayload = new Uint8Array(pathData.length + transaction.length);
    fullPayload.set(pathData, 0);
    fullPayload.set(transaction, pathData.length);

    // Split into chunks
    const chunks: Uint8Array[] = [];
    for (let i = 0; i < fullPayload.length; i += CHUNK_SIZE) {
      chunks.push(fullPayload.slice(i, Math.min(i + CHUNK_SIZE, fullPayload.length)));
    }

    let lastResult: CommandResult<SignTransactionCommandResponse, MultiversxErrorCodes> | undefined;

    for (let i = 0; i < chunks.length; i++) {
      const isFirstChunk = i === 0;

      lastResult = await this.api.sendCommand(
        new SignTransactionCommand({
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
