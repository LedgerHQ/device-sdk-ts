// Edit Identifier — sub-command P1=0x03 of the address-book APDU (CLA 0xB0 /
// INS 0x10). Frames one chunk; on the final chunk parses the 33-byte response
// struct_type(0x31) + hmac_rest(32) (the rotated address-level proof).
// Intermediate chunks ack SW=0x9000 with no data. SW 0x6982 = seed/handle
// mismatch, surfaced via the shared error helper before any device UI.
// Protocol: Address Book Final Specifications — Edit Identifier.
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
  CONTACTS_APDU_CLA,
  CONTACTS_APDU_INS,
  HMAC_REST_BYTES,
  SUB_CMD_EDIT_IDENTIFIER,
} from "@internal/app-binder/model/contactsConstants";
import {
  CONTACTS_APP_ERRORS,
  contactsCommandErrorFactory,
  type ContactsErrorCodes,
} from "@internal/app-binder/model/contactsErrors";
import { STRUCT_TYPE_EDIT_IDENTIFIER } from "@internal/app-binder/services/contactsTlvSerializer";

export type EditExternalAddressIdentifierCommandArgs = {
  /** One framed chunk built by sendFramedContactsPayload. */
  readonly data: Uint8Array;
  /** 0x00 for the first/only chunk, 0x80 for continuation chunks. */
  readonly p2: number;
};

export type EditExternalAddressIdentifierCommandResponse = {
  /**
   * Present only on the final chunk — the device returns struct_type(0x31) +
   * hmac_rest(32) there. Intermediate chunks return SW=0x9000 with no data.
   * This is the replacement address-level proof (rotated `hmac_rest`).
   */
  readonly hmacRest?: Uint8Array;
};

const RESPONSE_STRUCT_TYPE = STRUCT_TYPE_EDIT_IDENTIFIER;

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

export class EditExternalAddressIdentifierCommand
  implements
    Command<
      EditExternalAddressIdentifierCommandResponse,
      EditExternalAddressIdentifierCommandArgs,
      ContactsErrorCodes
    >
{
  readonly name = "editExternalAddressIdentifier";
  readonly args: EditExternalAddressIdentifierCommandArgs;
  private readonly errorHelper = new CommandErrorHelper<
    EditExternalAddressIdentifierCommandResponse,
    ContactsErrorCodes
  >(CONTACTS_APP_ERRORS, contactsCommandErrorFactory);

  constructor(args: EditExternalAddressIdentifierCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    return new ApduBuilder({
      cla: CONTACTS_APDU_CLA,
      ins: CONTACTS_APDU_INS,
      p1: SUB_CMD_EDIT_IDENTIFIER,
      p2: this.args.p2,
    })
      .addBufferToData(this.args.data)
      .build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<
    EditExternalAddressIdentifierCommandResponse,
    ContactsErrorCodes
  > {
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

      const hmacRest = extractField(parser, HMAC_REST_BYTES);
      if (!hmacRest) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("hmac_rest missing or truncated"),
        });
      }

      return CommandResultFactory({
        data: { hmacRest },
      });
    });
  }
}
