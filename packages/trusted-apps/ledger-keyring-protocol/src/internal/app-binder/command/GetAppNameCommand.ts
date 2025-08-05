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
  type GetAppNameCommandArgs,
  type GetAppNameCommandResponse,
} from "@api/app-binder/GetAppNameCommandTypes";

import {
  LEDGER_SYNC_ERRORS,
  type LedgerKeyringProtocolErrorCodes,
  LedgerKeyringProtocolErrorFactory,
} from "./utils/ledgerKeyringProtocolErrors";

export class GetAppNameCommand
  implements
    Command<
      GetAppNameCommandResponse,
      GetAppNameCommandArgs,
      LedgerKeyringProtocolErrorCodes
    >
{
  private readonly errorHelper = new CommandErrorHelper<
    GetAppNameCommandResponse,
    LedgerKeyringProtocolErrorCodes
  >(LEDGER_SYNC_ERRORS, LedgerKeyringProtocolErrorFactory);

  getApdu(): Apdu {
    const getAppNameArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x03,
      p1: 0x00,
      p2: 0x00,
    };

    const builder = new ApduBuilder(getAppNameArgs);
    return builder.build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<GetAppNameCommandResponse, LedgerKeyringProtocolErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(apduResponse),
    ).orDefaultLazy(() => {
      const parser = new ApduParser(apduResponse);

      const name = parser.encodeToString(apduResponse.data);

      if (!name) {
        return CommandResultFactory({
          error: new InvalidStatusWordError(`Name is missing`),
        });
      }

      return CommandResultFactory({
        data: { name },
      });
    });
  }
}
