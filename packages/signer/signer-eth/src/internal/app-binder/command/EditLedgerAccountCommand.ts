// Edit Ledger Account (rename a signer-controlled account) — sub-command
// P1=0x12 of the address-book APDU (CLA 0xB0 / INS 0x10). Caller
// (SendEditLedgerAccountTask + sendFramedContactsPayload) assembles the TLV,
// prepends the 2-byte BE total length and slices into ≤255B chunks; this command
// frames one chunk and, on the final chunk, parses the 33-byte response:
// struct_type(0x30) + rotated hmac_proof(32).
//
// Errors are mapped through CONTACTS_APP_ERRORS so the seed-bound HMAC rejection
// (SW 0x6982, returned by the device *before* any UI) surfaces as the typed
// "registered with a different seed" ContactsCommandError rather than the
// generic ETH "Security status not satisfied" message.
// Protocol: ledger-secure-sdk/app_features/address_book/doc/address_book_spec.md §5.6
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
  STRUCT_TYPE_EDIT_LEDGER_ACCOUNT,
} from "@ledgerhq/device-management-kit";
import { CommandErrorHelper } from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

export type EditLedgerAccountCommandArgs = {
  /** One framed chunk built by sendFramedContactsPayload. */
  readonly data: Uint8Array;
  /** 0x00 for the first/only chunk, 0x80 for continuation chunks. */
  readonly p2: number;
};

export type EditLedgerAccountCommandResponse = {
  /**
   * Present only on the final chunk — struct_type(0x30) + rotated
   * hmac_proof(32). Intermediate chunks return SW=0x9000 with no data.
   */
  readonly hmacProofHex?: string;
};

const CLA = 0xb0;
const INS = 0x10;
const P1_EDIT_LEDGER_ACCOUNT = 0x12;

const RESPONSE_STRUCT_TYPE = STRUCT_TYPE_EDIT_LEDGER_ACCOUNT;
const HMAC_PROOF_BYTES = 32;

export class EditLedgerAccountCommand
  implements
    Command<
      EditLedgerAccountCommandResponse,
      EditLedgerAccountCommandArgs,
      ContactsErrorCodes
    >
{
  readonly name = "editLedgerAccount";
  readonly args: EditLedgerAccountCommandArgs;
  private readonly errorHelper = new CommandErrorHelper<
    EditLedgerAccountCommandResponse,
    ContactsErrorCodes
  >(CONTACTS_APP_ERRORS, contactsCommandErrorFactory);

  constructor(args: EditLedgerAccountCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    return new ApduBuilder({
      cla: CLA,
      ins: INS,
      p1: P1_EDIT_LEDGER_ACCOUNT,
      p2: this.args.p2,
    })
      .addBufferToData(this.args.data)
      .build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<EditLedgerAccountCommandResponse, ContactsErrorCodes> {
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

      const hmacProofHex = parser.encodeToHexaString(
        parser.extractFieldByLength(HMAC_PROOF_BYTES),
      );
      if (!hmacProofHex) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("hmac_proof missing"),
        });
      }

      return CommandResultFactory({ data: { hmacProofHex } });
    });
  }
}
