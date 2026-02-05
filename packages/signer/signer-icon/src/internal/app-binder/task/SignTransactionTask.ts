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
import { type IconErrorCodes } from "@internal/app-binder/command/utils/iconAppErrors";

type SignTransactionTaskArgs = {
  derivationPath: string;
  transaction: Uint8Array;
};

export class SignTransactionTask {
  constructor(
    private api: InternalApi,
    private args: SignTransactionTaskArgs,
  ) {}

  async run(): Promise<CommandResult<Signature, IconErrorCodes>> {
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

    // Build first chunk: pathData + txLength (4 bytes) + data
    const txLengthBytes = new Uint8Array(4);
    new DataView(txLengthBytes.buffer).setUint32(0, transaction.length, false);

    // Calculate first chunk size (path + txLength + data)
    const firstChunkHeaderSize = pathData.length + txLengthBytes.length;
    const firstChunkDataSize = Math.min(CHUNK_SIZE - firstChunkHeaderSize, transaction.length);

    const chunks: Uint8Array[] = [];

    // Build first chunk
    const firstChunk = new Uint8Array(firstChunkHeaderSize + firstChunkDataSize);
    firstChunk.set(pathData, 0);
    firstChunk.set(txLengthBytes, pathData.length);
    firstChunk.set(transaction.slice(0, firstChunkDataSize), firstChunkHeaderSize);
    chunks.push(firstChunk);

    // Build subsequent chunks
    let offset = firstChunkDataSize;
    while (offset < transaction.length) {
      const chunkSize = Math.min(CHUNK_SIZE, transaction.length - offset);
      chunks.push(transaction.slice(offset, offset + chunkSize));
      offset += chunkSize;
    }

    let lastResult: CommandResult<SignTransactionCommandResponse, IconErrorCodes> | undefined;

    // Send each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const isFirstChunk = i === 0;

      lastResult = await this.api.sendCommand(
        new SignTransactionCommand({
          chunk: chunk!,
          isFirstChunk,
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

    const { r, s, v } = lastResult.data;
    if (!r || !s || v === undefined) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("No signature in response"),
      });
    }

    // Convert to hex strings
    const rHex = Array.from(r)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const sHex = Array.from(s)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return CommandResultFactory({
      data: {
        r: rHex,
        s: sHex,
        v,
      },
    });
  }
}
