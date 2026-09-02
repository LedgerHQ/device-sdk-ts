// Provide Contact — sub-command P1=0x20 of the address-book APDU (CLA 0xB0 /
// INS 0x10). Sent before a signing APDU so the device renders a registered
// contact name in place of the raw recipient address. Caller
// (sendProvideContactPayload) assembles the TLV, prepends the 2-byte BE total
// length and slices into <=255B chunks; this command frames one chunk. Every
// chunk answers with SW=0x9000 and no data — the outcome is a device-side
// effect, not a returned value.
// Protocol: Address Book Final Specifications — Provide Contact.
import {
  type Apdu,
  ApduBuilder,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
} from "@ledgerhq/device-management-kit";
import { CommandErrorHelper } from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import {
  CONTACTS_APDU_CLA,
  CONTACTS_APDU_INS,
  SUB_CMD_PROVIDE_CONTACT,
} from "@internal/app-binder/model/contactsConstants";
import {
  CONTACTS_APP_ERRORS,
  contactsCommandErrorFactory,
  type ContactsErrorCodes,
} from "@internal/app-binder/model/contactsErrors";

export type ProvideContactCommandArgs = {
  /** One framed chunk built by sendProvideContactPayload. */
  readonly data: Uint8Array;
  /** 0x00 for the first/only chunk, 0x80 for continuation chunks. */
  readonly p2: number;
};

export type ProvideContactCommandResponse = void;

export class ProvideContactCommand
  implements
    Command<
      ProvideContactCommandResponse,
      ProvideContactCommandArgs,
      ContactsErrorCodes
    >
{
  readonly name = "provideContact";
  readonly args: ProvideContactCommandArgs;
  private readonly errorHelper = new CommandErrorHelper<
    ProvideContactCommandResponse,
    ContactsErrorCodes
  >(CONTACTS_APP_ERRORS, contactsCommandErrorFactory);

  constructor(args: ProvideContactCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    return new ApduBuilder({
      cla: CONTACTS_APDU_CLA,
      ins: CONTACTS_APDU_INS,
      p1: SUB_CMD_PROVIDE_CONTACT,
      p2: this.args.p2,
    })
      .addBufferToData(this.args.data)
      .build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<ProvideContactCommandResponse, ContactsErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(response),
    ).orDefaultLazy(() =>
      CommandResultFactory<ProvideContactCommandResponse, ContactsErrorCodes>({
        data: undefined,
      }),
    );
  }
}
