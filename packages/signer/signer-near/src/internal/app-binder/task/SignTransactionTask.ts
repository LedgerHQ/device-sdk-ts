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
import { type NearErrorCodes } from "@internal/app-binder/command/utils/nearAppErrors";

type SignTransactionTaskArgs = {
  derivationPath: string;
  transaction: Uint8Array;
};

export class SignTransactionTask {
  constructor(
    private api: InternalApi,
    private args: SignTransactionTaskArgs,
  ) {}

  async run(): Promise<CommandResult<Signature, NearErrorCodes>> {
    const { derivationPath, transaction } = this.args;
    const CHUNK_SIZE = SignTransactionCommand.CHUNK_SIZE;

    // Build BIP32 path bytes
    const paths = DerivationPathUtils.splitPath(derivationPath);
    const pathData = new Uint8Array(4 + paths.length * 4);
    const pathDataView = new DataView(pathData.buffer);
    
    // Path format: number of elements (4 bytes) + each element (4 bytes each)
    pathDataView.setUint32(0, paths.length, false); // Big-endian
    paths.forEach((element, index) => {
      pathDataView.setUint32(4 + index * 4, element, false);
    });

    // Combine path with transaction
    const fullData = new Uint8Array(pathData.length + transaction.length);
    fullData.set(pathData, 0);
    fullData.set(transaction, pathData.length);

    // Split into chunks
    const chunks: Uint8Array[] = [];
    for (let i = 0; i < fullData.length; i += CHUNK_SIZE) {
      const end = Math.min(i + CHUNK_SIZE, fullData.length);
      chunks.push(fullData.slice(i, end));
    }

    let lastResult: CommandResult<SignTransactionCommandResponse, NearErrorCodes> | undefined;

    // Send each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const isLastChunk = i === chunks.length - 1;

      lastResult = await this.api.sendCommand(
        new SignTransactionCommand({
          chunk: chunk!,
          isLastChunk,
        }),
      );

      if (!isSuccessCommandResult(lastResult)) {
        return lastResult;
      }
    }

    // Extract signature from last result
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

    // Return signature as hex string
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
