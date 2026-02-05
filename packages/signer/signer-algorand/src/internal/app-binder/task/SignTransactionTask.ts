import {
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";
import {
  SignTransactionCommand,
  type SignTransactionCommandResponse,
} from "@internal/app-binder/command/SignTransactionCommand";
import { type AlgorandErrorCodes } from "@internal/app-binder/command/utils/algorandAppErrors";

type SignTransactionTaskArgs = {
  derivationPath: string;
  transaction: Uint8Array;
};

/**
 * Extracts the account index from a BIP32 derivation path.
 * Algorand uses only the account index (3rd element: 44'/283'/X'/0/0)
 */
function extractAccountIndex(derivationPath: string): number {
  const parts = derivationPath.replace(/'/g, "").split("/");
  // Remove 'm' if present
  const indexParts = parts[0] === "m" ? parts.slice(1) : parts;
  // Account index is the 3rd element (index 2)
  const accountIndexStr = indexParts[2];
  if (indexParts.length < 3 || accountIndexStr === undefined) {
    throw new Error("Invalid derivation path for Algorand");
  }
  return parseInt(accountIndexStr, 10);
}

export class SignTransactionTask {
  constructor(
    private api: InternalApi,
    private args: SignTransactionTaskArgs,
  ) {}

  async run(): Promise<CommandResult<Signature, AlgorandErrorCodes>> {
    const { derivationPath, transaction } = this.args;
    const CHUNK_SIZE = SignTransactionCommand.CHUNK_SIZE;

    // Get account index and convert to 4-byte big-endian buffer
    const accountIndex = extractAccountIndex(derivationPath);
    const accountIndexBytes = new Uint8Array(4);
    new DataView(accountIndexBytes.buffer).setUint32(0, accountIndex, false); // Big-endian

    // Combine account index with transaction data
    const fullData = new Uint8Array(accountIndexBytes.length + transaction.length);
    fullData.set(accountIndexBytes, 0);
    fullData.set(transaction, accountIndexBytes.length);

    // Split into chunks
    const chunks: Uint8Array[] = [];
    for (let i = 0; i < fullData.length; i += CHUNK_SIZE) {
      const end = Math.min(i + CHUNK_SIZE, fullData.length);
      chunks.push(fullData.slice(i, end));
    }

    let lastResult: CommandResult<SignTransactionCommandResponse, AlgorandErrorCodes> | undefined;

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
