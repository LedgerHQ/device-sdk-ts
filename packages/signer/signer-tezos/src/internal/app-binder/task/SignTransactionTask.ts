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
import {
  TezosCurve,
  type TezosErrorCodes,
} from "@internal/app-binder/command/utils/tezosAppErrors";

type SignTransactionTaskArgs = {
  derivationPath: string;
  transaction: Uint8Array;
  curve?: TezosCurve;
};

export class SignTransactionTask {
  constructor(
    private api: InternalApi,
    private args: SignTransactionTaskArgs,
  ) {}

  async run(): Promise<CommandResult<Signature, TezosErrorCodes>> {
    const { derivationPath, transaction, curve = TezosCurve.ED25519 } = this.args;
    const CHUNK_SIZE = SignTransactionCommand.CHUNK_SIZE;

    // Build path bytes for first chunk
    const paths = DerivationPathUtils.splitPath(derivationPath);
    const pathData = new Uint8Array(1 + paths.length * 4);
    pathData[0] = paths.length;
    const pathDataView = new DataView(pathData.buffer);
    paths.forEach((element, index) => {
      pathDataView.setUint32(1 + index * 4, element, false);
    });

    // First chunk contains path, then transaction data follows
    const toSend: Uint8Array[] = [];
    toSend.push(pathData);

    // Split transaction into chunks
    let offset = 0;
    while (offset < transaction.length) {
      const chunkSize = Math.min(CHUNK_SIZE, transaction.length - offset);
      const chunk = transaction.slice(offset, offset + chunkSize);
      toSend.push(chunk);
      offset += chunkSize;
    }

    let lastResult: CommandResult<SignTransactionCommandResponse, TezosErrorCodes> | undefined;

    for (let i = 0; i < toSend.length; i++) {
      const isFirstChunk = i === 0;
      const isLastChunk = i === toSend.length - 1;

      lastResult = await this.api.sendCommand(
        new SignTransactionCommand({
          data: toSend[i]!,
          isFirstChunk,
          isLastChunk,
          curve,
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
