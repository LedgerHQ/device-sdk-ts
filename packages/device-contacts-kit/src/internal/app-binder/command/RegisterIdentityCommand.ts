// Register Identity (register external address) — sub-command P1=0x01 of the
// address-book APDU (CLA 0xB0 / INS 0x10). Caller (SendRegisterIdentityTask +
// sendFramedContactsPayload) assembles the TLV, prepends the 2-byte BE total
// length and slices into <=255B chunks; this command frames one chunk and, on
// the final chunk, parses the 129-byte response: struct_type(0x2d) +
// group_handle(64) + hmac_proof(32) + hmac_rest(32). Intermediate chunks ack
// with SW=0x9000 and no data.
// Protocol: Address Book Final Specifications — Register Identity.
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
  GROUP_HANDLE_BYTES,
  HMAC_PROOF_BYTES,
  HMAC_REST_BYTES,
  SUB_CMD_REGISTER_IDENTITY,
} from "@internal/app-binder/model/contactsConstants";
import {
  CONTACTS_APP_ERRORS,
  contactsCommandErrorFactory,
  type ContactsErrorCodes,
} from "@internal/app-binder/model/contactsErrors";

export type RegisterIdentityCommandArgs = {
  /** One framed chunk built by sendFramedContactsPayload. */
  readonly data: Uint8Array;
  /** 0x00 for the first/only chunk, 0x80 for continuation chunks. */
  readonly p2: number;
};

export type RegisterIdentityCommandResponse = {
  /**
   * Present only on the final chunk — the device returns struct_type(0x2d) +
   * group_handle(64) + hmac_proof(32) + hmac_rest(32) there. Intermediate
   * chunks return SW=0x9000 with no data.
   *
   * `hmacProof` is the device's HMAC_PROOF (binds the contact name);
   * `hmacRest` is the HMAC_REST (binds scope + identifier + family).
   */
  readonly groupHandle?: Uint8Array;
  readonly hmacProof?: Uint8Array;
  readonly hmacRest?: Uint8Array;
};

const RESPONSE_STRUCT_TYPE = 0x2d;

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
      cla: CONTACTS_APDU_CLA,
      ins: CONTACTS_APDU_INS,
      p1: SUB_CMD_REGISTER_IDENTITY,
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

      const groupHandle = extractField(parser, GROUP_HANDLE_BYTES);
      if (!groupHandle) {
        return CommandResultFactory({
          error: new InvalidStatusWordError(
            "group_handle missing or truncated",
          ),
        });
      }

      const hmacProof = extractField(parser, HMAC_PROOF_BYTES);
      if (!hmacProof) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("hmac_name missing or truncated"),
        });
      }

      const hmacRest = extractField(parser, HMAC_REST_BYTES);
      if (!hmacRest) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("hmac_rest missing or truncated"),
        });
      }

      return CommandResultFactory({
        data: { groupHandle, hmacProof, hmacRest },
      });
    });
  }
}
