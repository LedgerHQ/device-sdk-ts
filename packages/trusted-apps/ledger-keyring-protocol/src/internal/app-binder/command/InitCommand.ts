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
  type InitCommandArgs,
  type InitCommandResponse,
} from "@api/app-binder/InitCommandTypes";

import {
  LEDGER_SYNC_ERRORS,
  type LedgerKeyringProtocolErrorCodes,
  LedgerKeyringProtocolErrorFactory,
} from "./utils/ledgerKeyringProtocolErrors";

export class InitCommand
  implements
    Command<
      InitCommandResponse,
      InitCommandArgs,
      LedgerKeyringProtocolErrorCodes
    >
{
  constructor(private readonly args: InitCommandArgs) {}

  private readonly errorHelper = new CommandErrorHelper<
    void,
    LedgerKeyringProtocolErrorCodes
  >(LEDGER_SYNC_ERRORS, LedgerKeyringProtocolErrorFactory);

  getApdu(): Apdu {
    const { publicKey } = this.args;

    return new ApduBuilder({ cla: 0xe0, ins: 0x06, p1: 0x00, p2: 0x00 })
      .addBufferToData(publicKey)
      .build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<InitCommandResponse, LedgerKeyringProtocolErrorCodes> {
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
