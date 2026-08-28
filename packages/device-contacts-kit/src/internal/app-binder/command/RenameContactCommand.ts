// Rename Contact (EDIT CONTACT NAME) — the blockchain-agnostic address-book
// rename. It is dispatched as an OS/dashboard command (CLA 0xE0 / INS 0x2E /
// P1 0x00), NOT through the embedded app: the caller navigates to the dashboard
// first (GoToDashboardDeviceAction) so the OS handles it directly.
// SendRenameContactTask + sendFramedContactsPayload assemble the TLV, prepend
// the 2-byte BE total length and slice into <=255B chunks; this command frames
// one chunk and, on the final chunk, parses the 33-byte response:
// struct_type(0x2e) + rotated hmac_name(32). Intermediate chunks ack with
// SW=0x9000 and no data.
//
// The device is stateless: it verifies the supplied group handle + old-name
// proof against the seed-derived key (SW 0x6982 on a seed mismatch, before any
// UI) and, on approval, returns a fresh proof for the new name.
// Protocol: Address Book Final Specifications — Edit Contact Name.
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
  HMAC_NAME_BYTES,
  RENAME_CONTACT_APDU_CLA,
  RENAME_CONTACT_APDU_INS,
  RENAME_CONTACT_P1,
} from "@internal/app-binder/model/contactsConstants";
import {
  CONTACTS_APP_ERRORS,
  contactsCommandErrorFactory,
  type ContactsErrorCodes,
} from "@internal/app-binder/model/contactsErrors";
import { STRUCT_TYPE_EDIT_CONTACT_NAME } from "@internal/app-binder/services/contactsTlvSerializer";

export type RenameContactCommandArgs = {
  /** One framed chunk built by sendFramedContactsPayload. */
  readonly data: Uint8Array;
  /** 0x00 for the first/only chunk, 0x80 for continuation chunks. */
  readonly p2: number;
};

export type RenameContactCommandResponse = {
  /**
   * Present only on the final chunk — the device returns struct_type(0x2e) +
   * rotated hmac_name(32) there. Intermediate chunks return SW=0x9000 with no
   * data. This is the replacement group-level name proof.
   */
  readonly hmacProof?: Uint8Array;
};

const RESPONSE_STRUCT_TYPE = STRUCT_TYPE_EDIT_CONTACT_NAME;

/**
 * Extract `length` bytes as a freshly-owned plain `Uint8Array` (the parser may
 * hand back a `Buffer` view backed by the response), or `undefined` if the
 * response is too short.
 */
function extractField(
  parser: ApduParser,
  length: number,
): Uint8Array | undefined {
  const field = parser.extractFieldByLength(length);
  if (!field || field.length !== length) return undefined;
  return Uint8Array.from(field);
}

export class RenameContactCommand
  implements
    Command<
      RenameContactCommandResponse,
      RenameContactCommandArgs,
      ContactsErrorCodes
    >
{
  readonly name = "renameContact";
  readonly args: RenameContactCommandArgs;
  private readonly errorHelper = new CommandErrorHelper<
    RenameContactCommandResponse,
    ContactsErrorCodes
  >(CONTACTS_APP_ERRORS, contactsCommandErrorFactory);

  constructor(args: RenameContactCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    return new ApduBuilder({
      cla: RENAME_CONTACT_APDU_CLA,
      ins: RENAME_CONTACT_APDU_INS,
      p1: RENAME_CONTACT_P1,
      p2: this.args.p2,
    })
      .addBufferToData(this.args.data)
      .build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<RenameContactCommandResponse, ContactsErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(response),
    ).orDefaultLazy(() => {
      if (response.data.length === 0) {
        // Intermediate chunk — device acks with SW=0x9000 and no payload.
        return CommandResultFactory({ data: {} });
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

      const hmacProof = extractField(parser, HMAC_NAME_BYTES);
      if (!hmacProof) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("hmac_name missing or truncated"),
        });
      }

      return CommandResultFactory({
        data: { hmacProof },
      });
    });
  }
}
