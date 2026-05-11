// Wire reference:
// ~/dev/app-ethereum/client/src/ledger_app_clients/ethereum/address_book.py:296-336
//   prepare_edit_contact_name → CLA=0xB0, INS=0x10, P1=0x02, P2=0x00.
// Caller (SendEditContactNameTask) assembles the TLV payload; this command
// just frames it and parses the 33-byte structured response (struct_type + hmac_name).
//
// UPGRADE POINT — OS-dispatch: today the polyfill dispatches via the ETH
// app's CLA (0xB0). When firmware OS-dispatch lands, the CLA byte changes
// to the OS-level one; the payload and response shape don't.
import { type Apdu } from "@api/apdu/model/Apdu";
import { ApduBuilder } from "@api/apdu/utils/ApduBuilder";
import { ApduParser } from "@api/apdu/utils/ApduParser";
import { type Command } from "@api/command/Command";
import {
  type CommandResult,
  CommandResultFactory,
} from "@api/command/model/CommandResult";
import { InvalidStatusWordError } from "@api/command/Errors";
import { GlobalCommandErrorHandler } from "@api/command/utils/GlobalCommandError";
import { type ApduResponse } from "@api/device-session/ApduResponse";

export type EditContactNameCommandArgs = {
  /** Pre-assembled TLV payload. Built by SendEditContactNameTask. */
  readonly data: Uint8Array;
};

export type EditContactNameCommandResponse = {
  readonly hmacNameHex: string;
};

const EDIT_CONTACT_NAME_CLA = 0xb0;
const EDIT_CONTACT_NAME_INS = 0x10;
const EDIT_CONTACT_NAME_P1 = 0x02;
const EDIT_CONTACT_NAME_P2 = 0x00;

const RESPONSE_STRUCT_TYPE = 0x2e;
const HMAC_NAME_BYTES = 32;

export class EditContactNameCommand
  implements Command<EditContactNameCommandResponse, EditContactNameCommandArgs>
{
  readonly name = "editContactName";
  readonly args: EditContactNameCommandArgs;

  constructor(args: EditContactNameCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    return new ApduBuilder({
      cla: EDIT_CONTACT_NAME_CLA,
      ins: EDIT_CONTACT_NAME_INS,
      p1: EDIT_CONTACT_NAME_P1,
      p2: EDIT_CONTACT_NAME_P2,
    })
      .addBufferToData(this.args.data)
      .build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<EditContactNameCommandResponse> {
    const sw = response.statusCode;
    if (sw[0] !== 0x90 || sw[1] !== 0x00) {
      return CommandResultFactory({
        error: GlobalCommandErrorHandler.handle(response),
      });
    }

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

    const hmacNameHex = parser.encodeToHexaString(
      parser.extractFieldByLength(HMAC_NAME_BYTES),
    );
    if (!hmacNameHex) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("hmac_name missing"),
      });
    }

    return CommandResultFactory({
      data: { hmacNameHex },
    });
  }
}
