import {
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { DerivationPathUtils } from "@ledgerhq/signer-utils";

import { type Signature } from "@api/model/Signature";
import { SignTransactionCommand } from "@internal/app-binder/command/SignTransactionCommand";
import { type XrpErrorCodes } from "@internal/app-binder/command/utils/xrpAppErrors";

const MAX_CHUNK_SIZE = 150;

type SignTransactionTaskArgs = {
  derivationPath: string;
  transaction: Uint8Array;
  useEd25519?: boolean;
};

export class SignTransactionTask {
  constructor(
    private api: InternalApi,
    private args: SignTransactionTaskArgs,
  ) {}

  async run(): Promise<CommandResult<Signature, XrpErrorCodes>> {
    const { derivationPath, transaction, useEd25519 } = this.args;

    // Calculate chunk sizes
    const paths = DerivationPathUtils.splitPath(derivationPath);
    const firstChunkMaxDataSize = MAX_CHUNK_SIZE - 1 - paths.length * 4;

    // Split transaction into chunks
    const chunks: Uint8Array[] = [];
    let offset = 0;

    while (offset < transaction.length) {
      const isFirst = offset === 0;
      const maxChunkSize = isFirst ? firstChunkMaxDataSize : MAX_CHUNK_SIZE;
      const remaining = transaction.length - offset;
      const chunkSize = Math.min(maxChunkSize, remaining);

      chunks.push(transaction.slice(offset, offset + chunkSize));
      offset += chunkSize;
    }

    // Send each chunk
    let lastResult: CommandResult<{ signature: string }, XrpErrorCodes> | null =
      null;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      if (!chunk) continue;

      const isFirstChunk = i === 0;
      const hasMoreChunks = i < chunks.length - 1;

      const result = await this.api.sendCommand(
        new SignTransactionCommand({
          derivationPath,
          transaction: chunk,
          isFirstChunk,
          hasMoreChunks,
          useEd25519,
        }),
      );

      if (!isSuccessCommandResult(result)) {
        return result;
      }

      lastResult = result;
    }

    if (!lastResult || !isSuccessCommandResult(lastResult)) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("No response from device"),
      });
    }

    // Parse the signature from the last chunk response
    // XRP signatures are typically DER-encoded
    const signatureHex = lastResult.data.signature;

    return CommandResultFactory({
      data: {
        r: signatureHex, // Full signature as hex - XRP uses DER encoding
        s: "", // Not applicable for XRP DER signatures
        v: undefined,
      },
    });
  }
}
