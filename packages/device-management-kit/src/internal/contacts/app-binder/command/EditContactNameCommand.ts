// Edit Contact Name (rename an external contact) — the blockchain-agnostic
// address-book rename. It is dispatched as an OS/dashboard command
// (CLA 0xE0 / INS 0x2E / P1 0x00), NOT through the Ethereum app: the caller
// closes any running app first (CallTaskOnDashboardDeviceAction) so the OS
// handles it directly. SendEditContactNameTask + sendFramedContactsPayload
// assemble the TLV, prepend the 2-byte BE total length and slice into ≤255B
// chunks; this command frames one chunk and, on the final chunk, parses the
// 33-byte response: struct_type(0x2e) + rotated hmac_name(32). Intermediate
// chunks ack with SW=0x9000 and no data.
//
// The device is stateless: it verifies the supplied group handle + old-name
// proof against the seed-derived key (SW 0x6982 on a seed mismatch, before any
// UI) and, on approval, returns a fresh proof for the new name. Contract
// verified on-device (Ledger Flex, BOLOS 1.7.0-rc2).
// Protocol: ledger-secure-sdk/app_features/address_book/doc/address_book_spec.md §5.2
import { type Apdu } from "@api/apdu/model/Apdu";
import { ApduBuilder } from "@api/apdu/utils/ApduBuilder";
import { ApduParser } from "@api/apdu/utils/ApduParser";
import { type Command } from "@api/command/Command";
import { InvalidStatusWordError } from "@api/command/Errors";
import { type CommandResult } from "@api/command/model/CommandResult";
import {
  type ContactsErrorCodes,
  getContactsCommandError,
} from "@api/contacts/ContactsErrors";
import { type ApduResponse } from "@api/device-session/ApduResponse";
import { DmkResultFactory } from "@api/model/DmkResult";

export type EditContactNameCommandArgs = {
  /** One framed chunk built by sendFramedContactsPayload. */
  readonly data: Uint8Array;
  /** 0x00 for the first/only chunk, 0x80 for continuation chunks. */
  readonly p2: number;
};

export type EditContactNameCommandResponse = {
  /**
   * Present only on the final chunk — the device returns struct_type(0x2e) +
   * rotated hmac_name(32) there. Intermediate chunks return SW=0x9000 with no
   * data.
   */
  readonly hmacNameHex?: string;
};

const EDIT_CONTACT_NAME_CLA = 0xe0;
const EDIT_CONTACT_NAME_INS = 0x2e;
const EDIT_CONTACT_NAME_P1 = 0x00;

const RESPONSE_STRUCT_TYPE = 0x2e;
const HMAC_NAME_BYTES = 32;

export class EditContactNameCommand
  implements
    Command<
      EditContactNameCommandResponse,
      EditContactNameCommandArgs,
      ContactsErrorCodes
    >
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
      p2: this.args.p2,
    })
      .addBufferToData(this.args.data)
      .build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<EditContactNameCommandResponse, ContactsErrorCodes> {
    const sw = response.statusCode;
    if (sw[0] !== 0x90 || sw[1] !== 0x00) {
      return DmkResultFactory({
        error: getContactsCommandError(response),
      });
    }

    if (response.data.length === 0) {
      // Intermediate chunk — device acks with SW=0x9000 and no payload.
      return DmkResultFactory({ data: {} });
    }

    const parser = new ApduParser(response);
    const structType = parser.extract8BitUInt();
    if (structType !== RESPONSE_STRUCT_TYPE) {
      return DmkResultFactory({
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
      return DmkResultFactory({
        error: new InvalidStatusWordError("hmac_name missing"),
      });
    }

    return DmkResultFactory({
      data: { hmacNameHex },
    });
  }
}
