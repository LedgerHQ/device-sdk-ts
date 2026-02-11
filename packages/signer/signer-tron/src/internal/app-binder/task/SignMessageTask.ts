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
  SignMessageCommand,
  type SignMessageCommandResponse,
} from "@internal/app-binder/command/SignMessageCommand";
import { type TronErrorCodes } from "@internal/app-binder/command/utils/tronAppErrors";

type SignMessageTaskArgs = {
  derivationPath: string;
  message: string | Uint8Array;
};

export class SignMessageTask {
  constructor(
    private api: InternalApi,
    private args: SignMessageTaskArgs,
  ) {}

  async run(): Promise<CommandResult<Signature, TronErrorCodes>> {
    const { derivationPath, message } = this.args;
    const CHUNK_SIZE = SignMessageCommand.CHUNK_SIZE;

    // Convert message to Uint8Array if string (hex string)
    const messageBytes = typeof message === "string"
      ? new Uint8Array(Buffer.from(message, "hex"))
      : message;

    // Build first chunk with derivation path and message size prefix
    const paths = DerivationPathUtils.splitPath(derivationPath);
    const pathData = new Uint8Array(1 + paths.length * 4);
    pathData[0] = paths.length;
    const pathDataView = new DataView(pathData.buffer);
    paths.forEach((element, index) => {
      pathDataView.setUint32(1 + index * 4, element, false); // Big-endian
    });

    // Pack message with 4-byte size prefix (as hex string representation padded to 8 chars)
    const sizeHex = messageBytes.length.toString(16).padStart(8, "0");
    const sizeBytes = new Uint8Array(4);
    for (let i = 0; i < 4; i++) {
      sizeBytes[i] = parseInt(sizeHex.substring(i * 2, i * 2 + 2), 16);
    }

    // Combine: path + size + message
    const packed = new Uint8Array(sizeBytes.length + messageBytes.length);
    packed.set(sizeBytes, 0);
    packed.set(messageBytes, sizeBytes.length);

    // Split into chunks, first chunk includes path
    const chunks: Uint8Array[] = [];
    let offset = 0;

    // First chunk: path + as much of packed as fits
    const firstChunkMaxPayload = CHUNK_SIZE - pathData.length;
    const firstChunkPayloadSize = Math.min(firstChunkMaxPayload, packed.length);
    const firstChunk = new Uint8Array(pathData.length + firstChunkPayloadSize);
    firstChunk.set(pathData, 0);
    firstChunk.set(packed.slice(0, firstChunkPayloadSize), pathData.length);
    chunks.push(firstChunk);
    offset = firstChunkPayloadSize;

    // Subsequent chunks
    while (offset < packed.length) {
      const chunkSize = Math.min(CHUNK_SIZE, packed.length - offset);
      chunks.push(packed.slice(offset, offset + chunkSize));
      offset += chunkSize;
    }

    let lastResult: CommandResult<SignMessageCommandResponse, TronErrorCodes> | undefined;

    // Send each chunk
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const isFirstChunk = i === 0;

      lastResult = await this.api.sendCommand(
        new SignMessageCommand({
          chunk: chunk!,
          isFirstChunk,
        }),
      );

      if (!isSuccessCommandResult(lastResult)) {
        return lastResult;
      }
    }

    // The last chunk should have the signature
    if (!lastResult) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("No response received"),
      });
    }

    if (!isSuccessCommandResult(lastResult)) {
      return lastResult;
    }

    // The SignMessageCommand already returns the signature in the correct format
    return CommandResultFactory({
      data: lastResult.data,
    });
  }
}
