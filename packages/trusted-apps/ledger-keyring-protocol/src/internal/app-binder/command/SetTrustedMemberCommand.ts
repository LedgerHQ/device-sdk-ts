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

import { TPTags } from "@internal/models/Tags";

import {
  LEDGER_SYNC_ERRORS,
  type LedgerKeyRingProtocolErrorCodes,
  LedgerKeyRingProtocolErrorFactory,
} from "./utils/ledgerKeyRingProtocolErrors";

export type SetTrustedMemberCommandResponse = void;

export type SetTrustedMemberCommandArgs = {
  readonly iv: Uint8Array;
  readonly memberTlv: Uint8Array;
};

export class SetTrustedMemberCommand
  implements
    Command<
      SetTrustedMemberCommandResponse,
      SetTrustedMemberCommandArgs,
      LedgerKeyRingProtocolErrorCodes
    >
{
  readonly name = "setTrustedMember";
  private readonly errorHelper = new CommandErrorHelper<
    SetTrustedMemberCommandResponse,
    LedgerKeyRingProtocolErrorCodes
  >(LEDGER_SYNC_ERRORS, LedgerKeyRingProtocolErrorFactory);

  constructor(private readonly args: SetTrustedMemberCommandArgs) {}

  getApdu(): Apdu {
    const { iv, memberTlv } = this.args;
    return (
      new ApduBuilder({ cla: 0xe0, ins: 0x09, p1: 0x00, p2: 0x00 })
        // tag for IV
        .add8BitUIntToData(TPTags.IV)
        // IV length
        .add8BitUIntToData(iv.length)
        // IV bytes
        .addBufferToData(iv)
        // TrustedMember bytes
        .addBufferToData(memberTlv)
        .build()
    );
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<
    SetTrustedMemberCommandResponse,
    LedgerKeyRingProtocolErrorCodes
  > {
    return Maybe.fromNullable(
      this.errorHelper.getError(apduResponse),
    ).orDefaultLazy(() => {
      const parser = new ApduParser(apduResponse);
      if (parser.getUnparsedRemainingLength() !== 0) {
        return CommandResultFactory({
          error: new InvalidStatusWordError(
            "Unexpected response data for SetTrustedMemberCommand",
          ),
        });
      }
      return CommandResultFactory({ data: undefined });
    });
  }
}
