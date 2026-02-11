import {
  type Apdu,
  ApduBuilder,
  ApduParser,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
} from "@ledgerhq/device-management-kit";
import { CommandErrorHelper, DerivationPathUtils } from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import {
  XRP_APP_ERRORS,
  XrpAppCommandErrorFactory,
  type XrpErrorCodes,
} from "./utils/xrpAppErrors";

export type SignTransactionCommandArgs = {
  derivationPath: string;
  transaction: Uint8Array;
  isFirstChunk: boolean;
  hasMoreChunks: boolean;
  useEd25519?: boolean;
};

export type SignTransactionCommandResponse = {
  signature: string;
};

const MAX_CHUNK_SIZE = 150;

export class SignTransactionCommand
  implements
    Command<
      SignTransactionCommandResponse,
      SignTransactionCommandArgs,
      XrpErrorCodes
    >
{
  readonly name = "SignTransaction";

  private readonly _args: SignTransactionCommandArgs;
  private readonly errorHelper = new CommandErrorHelper<
    SignTransactionCommandResponse,
    XrpErrorCodes
  >(XRP_APP_ERRORS, XrpAppCommandErrorFactory);

  constructor(args: SignTransactionCommandArgs) {
    this._args = args;
  }

  getApdu(): Apdu {
    // XRP sign transaction command
    // CLA: 0xe0, INS: 0x04
    // P1: (isFirst ? 0x00 : 0x01) | (hasMore ? 0x80 : 0x00)
    // P2: curveMask (0x80 for ed25519, 0x40 for secp256k1)

    const curveMask = this._args.useEd25519 ? 0x80 : 0x40;
    const p1Flags =
      (this._args.isFirstChunk ? 0x00 : 0x01) |
      (this._args.hasMoreChunks ? 0x80 : 0x00);

    const builder = new ApduBuilder({
      cla: 0xe0,
      ins: 0x04,
      p1: p1Flags,
      p2: curveMask,
    });

    if (this._args.isFirstChunk) {
      // First chunk includes the derivation path
      const paths = DerivationPathUtils.splitPath(this._args.derivationPath);

      // Add number of path components
      builder.add8BitUIntToData(paths.length);

      // Add each path component as 4-byte big-endian
      paths.forEach((element) => {
        builder.add32BitUIntToData(element);
      });
    }

    // Add transaction data
    builder.addBufferToData(Buffer.from(this._args.transaction));

    return builder.build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<SignTransactionCommandResponse, XrpErrorCodes> {
    return Maybe.fromNullable(this.errorHelper.getError(response)).orDefaultLazy(
      () => {
        const parser = new ApduParser(response);

        // Get remaining bytes as signature
        const signatureBytes = parser.extractFieldByLength(
          parser.getUnparsedRemainingLength(),
        );

        const signature = signatureBytes
          ? Buffer.from(signatureBytes).toString("hex")
          : "";

        return CommandResultFactory({
          data: {
            signature,
          },
        });
      },
    );
  }

  /**
   * Helper to calculate the maximum transaction data size for the first chunk
   */
  static getFirstChunkMaxDataSize(pathLength: number): number {
    // First chunk: 1 byte for path length + 4 bytes per path component + transaction data
    return MAX_CHUNK_SIZE - 1 - pathLength * 4;
  }

  /**
   * Helper to get the maximum chunk size for subsequent chunks
   */
  static getSubsequentChunkMaxSize(): number {
    return MAX_CHUNK_SIZE;
  }
}
