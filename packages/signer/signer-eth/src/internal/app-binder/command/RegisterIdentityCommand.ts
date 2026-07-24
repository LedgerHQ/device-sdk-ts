// Register Identity (register external contact) — sub-command P1=0x01 of the
// address-book APDU (CLA 0xB0 / INS 0x10). Caller (SendRegisterIdentityTask +
// sendFramedContactsPayload) assembles the TLV, prepends the 2-byte BE total
// length and slices into ≤255B chunks; this command frames one chunk and, on
// the final chunk, parses the 129-byte response: struct_type(0x2d) +
// group_handle(64) + hmac_name(32) + hmac_rest(32). Intermediate chunks ack
// with SW=0x9000 and no data.
// Protocol: ledger-secure-sdk/app_features/address_book/doc/address_book_spec.md §5.1
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
} from "@ledgerhq/device-management-kit";
import { CommandErrorHelper } from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

export type RegisterIdentityCommandArgs = {
  /** One framed chunk built by sendFramedContactsPayload. */
  readonly data: Uint8Array;
  /** 0x00 for the first/only chunk, 0x80 for continuation chunks. */
  readonly p2: number;
};

export type RegisterIdentityCommandResponse = {
  /**
   * Present only on the final chunk — the device returns struct_type(0x2d) +
   * group_handle(64) + hmac_name(32) + hmac_rest(32) there. Intermediate
   * chunks return SW=0x9000 with no data.
   */
  readonly groupHandleHex?: string;
  readonly hmacNameHex?: string;
  readonly hmacRestHex?: string;
};

const REGISTER_IDENTITY_CLA = 0xb0;
const REGISTER_IDENTITY_INS = 0x10;
const REGISTER_IDENTITY_P1 = 0x01;

const RESPONSE_STRUCT_TYPE = 0x2d;
const GROUP_HANDLE_BYTES = 64;
const HMAC_NAME_BYTES = 32;
const HMAC_REST_BYTES = 32;

export class RegisterIdentityCommand
  implements
    Command<
      RegisterIdentityCommandResponse,
      RegisterIdentityCommandArgs,
      ContactsErrorCodes
    >
{
  readonly name = "registerIdentity";
  readonly args: RegisterIdentityCommandArgs;
  private readonly errorHelper = new CommandErrorHelper<
    RegisterIdentityCommandResponse,
    ContactsErrorCodes
  >(CONTACTS_APP_ERRORS, contactsCommandErrorFactory);

  constructor(args: RegisterIdentityCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    return new ApduBuilder({
      cla: REGISTER_IDENTITY_CLA,
      ins: REGISTER_IDENTITY_INS,
      p1: REGISTER_IDENTITY_P1,
      p2: this.args.p2,
    })
      .addBufferToData(this.args.data)
      .build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<RegisterIdentityCommandResponse, ContactsErrorCodes> {
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
