import {
  type Apdu,
  ApduBuilder,
  ApduParser,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
  CommandUtils,
  GlobalCommandErrorHandler,
  InvalidStatusWordError,
  isCommandErrorCode,
} from "@ledgerhq/device-management-kit";
import { DerivationPathUtils } from "@ledgerhq/signer-utils";
import { Just, type Maybe } from "purify-ts";

import { type Signature } from "@api/model/Signature";
import { PROTOCOL_VERSION } from "@internal/app-binder/command/utils/constants";
import { encodeVarint } from "@internal/utils/Varint";

import {
  BitcoinAppCommandError,
  bitcoinAppErrors,
} from "./utils/bitcoinAppErrors";

const R_LENGTH = 32;
const S_LENGTH = 32;

export type SignMessageCommandArgs = {
  /**
   * The BIP32 path (e.g., "m/44'/0'/0'/0/0")
   */
  readonly derivationPath: string;
  /**
   * The total length of the message to be signed
   */
  readonly messageLength: number;
  /**
   * The Merkle root of the message data
   */
  readonly messageMerkleRoot: Uint8Array;
};

export type SignMessageCommandResponse = Maybe<Signature>;

export class SignMessageCommand
  implements Command<SignMessageCommandResponse, SignMessageCommandArgs>
{
  readonly args: SignMessageCommandArgs;

  constructor(args: SignMessageCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    const { derivationPath, messageLength, messageMerkleRoot } = this.args;

    const builder = new ApduBuilder({
      cla: 0xe1,
      ins: 0x10,
      p1: 0x00,
      p2: PROTOCOL_VERSION,
    });

    const path = DerivationPathUtils.splitPath(derivationPath);
    builder.add8BitUIntToData(path.length);
    path.forEach((element) => {
      builder.add32BitUIntToData(element);
    });

    return builder
      .addBufferToData(encodeVarint(messageLength).unsafeCoerce()) // Message length (varint)
      .addBufferToData(messageMerkleRoot)
      .build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<SignMessageCommandResponse> {
    const parser = new ApduParser(apduResponse);
    const errorCode = parser.encodeToHexaString(apduResponse.statusCode);
    if (isCommandErrorCode(errorCode, bitcoinAppErrors)) {
      return CommandResultFactory({
        error: new BitcoinAppCommandError({
          ...bitcoinAppErrors[errorCode],
          errorCode,
        }),
      });
    }

    if (!CommandUtils.isSuccessResponse(apduResponse)) {
      return CommandResultFactory({
        error: GlobalCommandErrorHandler.handle(apduResponse),
      });
    }

    // Extract 'v'
    const v = parser.extract8BitUInt();
    if (v === undefined) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("V is missing"),
      });
    }

    // Extract 'r'
    const r = parser.encodeToHexaString(
      parser.extractFieldByLength(R_LENGTH),
      true,
    );
    if (!r) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("R is missing"),
      });
    }

    // Extract 's'
    const s = parser.encodeToHexaString(
      parser.extractFieldByLength(S_LENGTH),
      true,
    );
    if (!s) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("S is missing"),
      });
    }

    return CommandResultFactory({
      data: Just({
        v,
        r,
        s,
      }),
    });
  }
}
