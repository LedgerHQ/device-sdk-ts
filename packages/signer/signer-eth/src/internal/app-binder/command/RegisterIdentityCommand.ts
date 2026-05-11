// Wire reference:
// ~/dev/app-ethereum/client/src/ledger_app_clients/ethereum/address_book.py:187-223
//   prepare_register_identity → CLA=0xB0, INS=0x10, P1=0x01, P2=0x00.
// Caller (SendRegisterIdentityTask) assembles the TLV payload; this command
// just frames it and parses the 129-byte structured response.
import {
  type Apdu,
  ApduBuilder,
  ApduParser,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";
import { CommandErrorHelper } from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import {
  ETH_APP_ERRORS,
  EthAppCommandErrorFactory,
  type EthErrorCodes,
} from "./utils/ethAppErrors";

export type RegisterIdentityCommandArgs = {
  /** Pre-assembled TLV payload (≤ 255 bytes). Built by SendRegisterIdentityTask. */
  readonly data: Uint8Array;
};

export type RegisterIdentityCommandResponse = {
  readonly groupHandleHex: string;
  readonly hmacNameHex: string;
  readonly hmacRestHex: string;
};

const REGISTER_IDENTITY_CLA = 0xb0;
const REGISTER_IDENTITY_INS = 0x10;
const REGISTER_IDENTITY_P1 = 0x01;
const REGISTER_IDENTITY_P2 = 0x00;

const RESPONSE_STRUCT_TYPE = 0x2d;
const GROUP_HANDLE_BYTES = 64;
const HMAC_NAME_BYTES = 32;
const HMAC_REST_BYTES = 32;

export class RegisterIdentityCommand
  implements
    Command<
      RegisterIdentityCommandResponse,
      RegisterIdentityCommandArgs,
      EthErrorCodes
    >
{
  readonly name = "registerIdentity";
  readonly args: RegisterIdentityCommandArgs;
  private readonly errorHelper = new CommandErrorHelper<
    RegisterIdentityCommandResponse,
    EthErrorCodes
  >(ETH_APP_ERRORS, EthAppCommandErrorFactory);

  constructor(args: RegisterIdentityCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    return new ApduBuilder({
      cla: REGISTER_IDENTITY_CLA,
      ins: REGISTER_IDENTITY_INS,
      p1: REGISTER_IDENTITY_P1,
      p2: REGISTER_IDENTITY_P2,
    })
      .addBufferToData(this.args.data)
      .build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<RegisterIdentityCommandResponse, EthErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(response),
    ).orDefaultLazy(() => {
      const parser = new ApduParser(response);

      const structType = parser.extract8BitUInt();
      if (structType !== RESPONSE_STRUCT_TYPE) {
        return CommandResultFactory({
          error: new InvalidStatusWordError(
            `Expected struct_type 0x${RESPONSE_STRUCT_TYPE.toString(16)}, got ${
              structType === undefined
                ? "undefined"
                : `0x${structType.toString(16)}`
            }`,
          ),
        });
      }

      const groupHandleHex = parser.encodeToHexaString(
        parser.extractFieldByLength(GROUP_HANDLE_BYTES),
      );
      if (!groupHandleHex) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("group_handle missing"),
        });
      }

      const hmacNameHex = parser.encodeToHexaString(
        parser.extractFieldByLength(HMAC_NAME_BYTES),
      );
      if (!hmacNameHex) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("hmac_name missing"),
        });
      }

      const hmacRestHex = parser.encodeToHexaString(
        parser.extractFieldByLength(HMAC_REST_BYTES),
      );
      if (!hmacRestHex) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("hmac_rest missing"),
        });
      }

      return CommandResultFactory({
        data: { groupHandleHex, hmacNameHex, hmacRestHex },
      });
    });
  }
}
