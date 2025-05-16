import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
} from "@ledgerhq/device-management-kit";
import { CommandErrorHelper } from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import { type InitCommandArgs } from "@api/app-binder/InitCommandTypes";

import {
  LEDGER_SYNC_ERRORS,
  type LedgerSyncErrorCodes,
  LedgerSyncErrorFactory,
} from "./utils/ledgerSyncErrors";

export class InitCommand
  implements Command<void, InitCommandArgs, LedgerSyncErrorCodes>
{
  constructor(private readonly args: InitCommandArgs) {}

  private readonly errorHelper = new CommandErrorHelper<
    void,
    LedgerSyncErrorCodes
  >(LEDGER_SYNC_ERRORS, LedgerSyncErrorFactory);

  getApdu(): Apdu {
    const { pubKey } = this.args;
    const initArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x06,
      p1: 0x00,
      p2: 0x00,
    };

    const builder = new ApduBuilder(initArgs);
    builder.addHexaStringToData(pubKey);
    return builder.build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<void, LedgerSyncErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(apduResponse),
    ).orDefault(CommandResultFactory({ data: undefined }));
  }
}
