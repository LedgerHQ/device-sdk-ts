import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  // ApduParser,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
} from "@ledgerhq/device-management-kit";
import { CommandErrorHelper } from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import {
  type SetTrustedMemberCommandArgs,
  type SetTrustedMemberCommandResponse,
} from "@api/app-binder/SetTrustedMemberTypes";

import {
  LEDGER_SYNC_ERRORS,
  type LedgerKeyringProtocolErrorCodes,
  LedgerKeyringProtocolErrorFactory,
} from "./utils/ledgerKeyringProtocolErrors";

export class SetTrustedMemberCommand
  implements
    Command<
      SetTrustedMemberCommandResponse,
      SetTrustedMemberCommandArgs,
      LedgerKeyringProtocolErrorCodes
    >
{
  private readonly errorHelper = new CommandErrorHelper<
    SetTrustedMemberCommandResponse,
    LedgerKeyringProtocolErrorCodes
  >(LEDGER_SYNC_ERRORS, LedgerKeyringProtocolErrorFactory);
  constructor(private readonly args: SetTrustedMemberCommandArgs) {}

  getApdu(): Apdu {
    const { p1, iv, trustedMember } = this.args;
    const setTrustedMemberArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x09,
      p1,
      p2: 0x00,
    };

    const builder = new ApduBuilder(setTrustedMemberArgs);
    builder.add8BitUIntToData(0x00);
    builder.add8BitUIntToData(0x10);
    builder.addBufferToData(iv);
    builder.add8BitUIntToData(0x06);
    builder.add8BitUIntToData(trustedMember.length);
    builder.addBufferToData(trustedMember);
    return builder.build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<
    SetTrustedMemberCommandResponse,
    LedgerKeyringProtocolErrorCodes
  > {
    return Maybe.fromNullable(
      this.errorHelper.getError(apduResponse),
    ).orDefaultLazy(() => {
      // const parser = new ApduParser(apduResponse);

      return CommandResultFactory({
        data: {},
      });
    });
  }
}
