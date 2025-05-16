import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
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
  type GetVersionCommandArgs,
  type GetVersionCommandResponse,
} from "@api/app-binder/GetVersionCommandTypes";

import {
  LEDGER_SYNC_ERRORS,
  type LedgerSyncErrorCodes,
  LedgerSyncErrorFactory,
} from "./utils/ledgerSyncErrors";

export class GetVersionCommand
  implements
    Command<
      GetVersionCommandResponse,
      GetVersionCommandArgs,
      LedgerSyncErrorCodes
    >
{
  private readonly errorHelper = new CommandErrorHelper<
    GetVersionCommandResponse,
    LedgerSyncErrorCodes
  >(LEDGER_SYNC_ERRORS, LedgerSyncErrorFactory);

  getApdu(): Apdu {
    const getVersionArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x03,
      p1: 0x00,
      p2: 0x00,
    };

    const builder = new ApduBuilder(getVersionArgs);
    return builder.build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<GetVersionCommandResponse, LedgerSyncErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(apduResponse),
    ).orDefaultLazy(() => {
      const parser = new ApduParser(apduResponse);

      const version = parser.encodeToString(apduResponse.data);

      if (!version) {
        return CommandResultFactory({
          error: new InvalidStatusWordError(`Version is missing`),
        });
      }

      return CommandResultFactory({
        data: { version },
      });
    });
  }
}
