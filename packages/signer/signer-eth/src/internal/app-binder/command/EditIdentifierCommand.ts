// Wire reference:
// ledger-secure-sdk/app_features/address_book/doc/address_book_spec.md
//   prepare_edit_identifier → CLA=0xB0, INS=0x10, P1=0x03 (SUB_CMD_EDIT_IDENTIFIER).
// Caller (SendEditIdentifierTask + sendFramedContactsPayload) assembles the TLV
// payload, prepends the 2-byte BE total length, and slices into ≤255B chunks;
// this command frames a single chunk and (on the final chunk only) parses the
// 33-byte structured response (struct_type + 32B hmac_rest).
//
// NOT an UPGRADE POINT — unlike op 2 (DMK-core, OS-dispatchable), op 3 stays
// in the ETH app forever because address-format validation is the coin app's
// responsibility, not the OS.
import {
  type Apdu,
  ApduBuilder,
  ApduParser,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
  CONTACTS_APP_ERRORS,
  contactsCommandErrorFactory,
  type ContactsErrorCodes,
  InvalidStatusWordError,
  STRUCT_TYPE_EDIT_IDENTIFIER,
} from "@ledgerhq/device-management-kit";
import { CommandErrorHelper } from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

export type EditIdentifierCommandArgs = {
  /** One framed chunk built by sendFramedContactsPayload. */
  readonly data: Uint8Array;
  /** 0x00 for the first/only chunk, 0x80 for continuation chunks. */
  readonly p2: number;
};

export type EditIdentifierCommandResponse = {
  /**
   * Present only on the final chunk — the device returns
   * struct_type(0x31) + 32B hmac_rest there. Intermediate chunks
   * return SW=0x9000 with no data.
   */
  readonly hmacRestHex?: string;
};

const EDIT_IDENTIFIER_CLA = 0xb0;
const EDIT_IDENTIFIER_INS = 0x10;
const EDIT_IDENTIFIER_P1 = 0x03;

const HMAC_REST_BYTES = 32;

export class EditIdentifierCommand
  implements
    Command<
      EditIdentifierCommandResponse,
      EditIdentifierCommandArgs,
      ContactsErrorCodes
    >
{
  readonly name = "editIdentifier";
  readonly args: EditIdentifierCommandArgs;
  private readonly errorHelper = new CommandErrorHelper<
    EditIdentifierCommandResponse,
    ContactsErrorCodes
  >(CONTACTS_APP_ERRORS, contactsCommandErrorFactory);

  constructor(args: EditIdentifierCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    return new ApduBuilder({
      cla: EDIT_IDENTIFIER_CLA,
      ins: EDIT_IDENTIFIER_INS,
      p1: EDIT_IDENTIFIER_P1,
      p2: this.args.p2,
    })
      .addBufferToData(this.args.data)
      .build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<EditIdentifierCommandResponse, ContactsErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(response),
    ).orDefaultLazy(() => {
      if (response.data.length === 0) {
        // Intermediate chunk — device acks with SW=9000 and no payload.
        return CommandResultFactory({ data: {} });
      }

      const parser = new ApduParser(response);
      const structType = parser.extract8BitUInt();
      if (structType !== STRUCT_TYPE_EDIT_IDENTIFIER) {
        return CommandResultFactory({
          error: new InvalidStatusWordError(
            `Expected struct_type 0x${STRUCT_TYPE_EDIT_IDENTIFIER.toString(16)}, got ${
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
    });
  }
}
