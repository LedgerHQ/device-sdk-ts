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

import { type AppConfiguration } from "@api/model/AppConfiguration";
import {
  CONCORDIUM_APP_ERRORS,
  ConcordiumAppCommandErrorFactory,
  type ConcordiumErrorCodes,
} from "@internal/app-binder/command/utils/ConcordiumApplicationErrors";
import { INS, LEDGER_CLA, P2 } from "@internal/app-binder/constants";

export type GetAppConfigCommandResponse = AppConfiguration;

export class GetAppConfigCommand
  implements Command<GetAppConfigCommandResponse, void, ConcordiumErrorCodes>
{
  readonly name = "GetAppConfig";

  private readonly errorHelper = new CommandErrorHelper<
    GetAppConfigCommandResponse,
    ConcordiumErrorCodes
  >(CONCORDIUM_APP_ERRORS, ConcordiumAppCommandErrorFactory);

  getApdu(): Apdu {
    return new ApduBuilder({
      cla: LEDGER_CLA,
      ins: INS.GET_APP_VERSION,
      p1: 0x00,
      p2: P2.NONE,
    }).build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<GetAppConfigCommandResponse, ConcordiumErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(apduResponse),
    ).orDefaultLazy(() => {
      const apduParser = new ApduParser(apduResponse);
      const major = apduParser.extract8BitUInt();
      const minor = apduParser.extract8BitUInt();
      const patch = apduParser.extract8BitUInt();

      if (major === undefined || minor === undefined || patch === undefined) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Cannot extract app version"),
        });
      }

      return CommandResultFactory({
        data: { version: `${major}.${minor}.${patch}` },
      });
    });
  }
}
