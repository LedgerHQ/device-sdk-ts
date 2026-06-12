// Wire reference:
// ~/dev/app-ethereum/client/src/ledger_app_clients/ethereum/address_book.py:337-391
//   prepare_edit_scope → CLA=0xB0, INS=0x10, P1=0x04 (SUB_CMD_EDIT_SCOPE).
// Caller (SendEditScopeTask + sendFramedContactsPayload) assembles the
// TLV payload, prepends the 2-byte BE total length, and slices into
// ≤255B chunks; this command just frames a single chunk and (on the
// final chunk only) parses the 33-byte structured response
// (struct_type + 32B hmac_rest).
//
// UPGRADE POINT — OS-dispatch: today the polyfill dispatches via the
// ETH app's CLA (0xB0). When firmware OS-dispatch lands, the CLA byte
// changes to the OS-level one; the payload and response shape don't.
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
import { STRUCT_TYPE_EDIT_SCOPE } from "@api/contacts/utils/contactsTlvSerializer";

export type EditScopeCommandArgs = {
  /** One framed chunk built by sendFramedContactsPayload. */
  readonly data: Uint8Array;
  /** 0x00 for the first/only chunk, 0x80 for continuation chunks. */
  readonly p2: number;
};

export type EditScopeCommandResponse = {
  /**
   * Present only on the final chunk — the device returns
   * struct_type(0x32) + 32B hmac_rest there. Intermediate chunks
   * return SW=0x9000 with no data.
   */
  readonly hmacRestHex?: string;
};

const EDIT_SCOPE_CLA = 0xb0;
const EDIT_SCOPE_INS = 0x10;
const EDIT_SCOPE_P1 = 0x04;

const HMAC_REST_BYTES = 32;

export class EditScopeCommand
  implements Command<EditScopeCommandResponse, EditScopeCommandArgs>
{
  readonly name = "editScope";
  readonly args: EditScopeCommandArgs;

  constructor(args: EditScopeCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    return new ApduBuilder({
      cla: EDIT_SCOPE_CLA,
      ins: EDIT_SCOPE_INS,
      p1: EDIT_SCOPE_P1,
      p2: this.args.p2,
    })
      .addBufferToData(this.args.data)
      .build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<EditScopeCommandResponse> {
    const sw = response.statusCode;
    if (sw[0] !== 0x90 || sw[1] !== 0x00) {
      return CommandResultFactory({
        error: GlobalCommandErrorHandler.handle(response),
      });
    }

    if (response.data.length === 0) {
      // Intermediate chunk — device acks with SW=9000 and no payload.
      return CommandResultFactory({ data: {} });
    }

    const parser = new ApduParser(response);
    const structType = parser.extract8BitUInt();
    if (structType !== STRUCT_TYPE_EDIT_SCOPE) {
      return CommandResultFactory({
        error: new InvalidStatusWordError(
          `Expected struct_type 0x${STRUCT_TYPE_EDIT_SCOPE.toString(16)}, got ${
            structType === undefined
              ? "undefined"
              : `0x${structType.toString(16)}`
          }`,
        ),
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
      data: { hmacRestHex },
    });
  }
}
