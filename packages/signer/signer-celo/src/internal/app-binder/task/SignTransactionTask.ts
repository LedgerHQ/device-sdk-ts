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
import { type CeloErrorCodes } from "@internal/app-binder/command/utils/celoAppErrors";

type SignTransactionTaskArgs = {
  derivationPath: string;
  transaction: Uint8Array;
};

export class SignTransactionTask {
  constructor(
    private api: InternalApi,
    private args: SignTransactionTaskArgs,
  ) {}

  async run(): Promise<CommandResult<Signature, CeloErrorCodes>> {
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

    // First chunk includes path
    const firstChunkMaxSize = CHUNK_SIZE - pathData.length;
    const firstChunkTxSize = Math.min(firstChunkMaxSize, transaction.length);
    const firstChunk = new Uint8Array(pathData.length + firstChunkTxSize);
    firstChunk.set(pathData, 0);
    firstChunk.set(transaction.slice(0, firstChunkTxSize), pathData.length);

    let lastResult = await this.api.sendCommand(
      new SignTransactionCommand({
        chunk: firstChunk,
        isFirstChunk: true,
      }),
    );

    if (!isSuccessCommandResult(lastResult)) {
      return lastResult;
    }

    // Send remaining chunks
    let offset = firstChunkTxSize;
    while (offset < transaction.length) {
      const chunkSize = Math.min(CHUNK_SIZE, transaction.length - offset);
      const chunk = transaction.slice(offset, offset + chunkSize);

      lastResult = await this.api.sendCommand(
        new SignTransactionCommand({
          chunk,
          isFirstChunk: false,
        }),
      );

      if (!isSuccessCommandResult(lastResult)) {
        return lastResult as CommandResult<Signature, CeloErrorCodes>;
      }

      offset += chunkSize;
    }

    const result = lastResult as CommandResult<SignTransactionCommandResponse, CeloErrorCodes>;
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
