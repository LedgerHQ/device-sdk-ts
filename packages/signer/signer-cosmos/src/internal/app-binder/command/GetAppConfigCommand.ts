import {
  type Apdu,
  ApduParser,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";
import { ApduBuilder } from "@ledgerhq/device-management-kit";
import { CommandErrorHelper } from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import { type AppConfig } from "@api/model/AppConfig";
import {
  COSMOS_APP_ERRORS,
  CosmosAppCommandErrorFactory,
  type CosmosErrorCodes,
} from "@internal/app-binder/command/utils/CosmosApplicationErrors";

export type GetAppConfigCommandResponse = AppConfig;

export const COSMOS_GET_APP_CONFIG_APDU_HEADER = {
  cla: 0x55,
  ins: 0x00,
  p1: 0x00,
  p2: 0x00,
};

export class GetAppConfigCommand
  implements Command<GetAppConfigCommandResponse, void, CosmosErrorCodes>
{
  readonly name = "GetAppConfig";

  private readonly errorHelper = new CommandErrorHelper<
    GetAppConfigCommandResponse,
    CosmosErrorCodes
  >(COSMOS_APP_ERRORS, CosmosAppCommandErrorFactory);

  getApdu(): Apdu {
    return new ApduBuilder(COSMOS_GET_APP_CONFIG_APDU_HEADER).build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<GetAppConfigCommandResponse, CosmosErrorCodes> {
    return Maybe.fromNullable(
      this.errorHelper.getError(apduResponse),
    ).orDefaultLazy(() => {
      const apduParser = new ApduParser(apduResponse);
      apduParser.extract8BitUInt(); // Skip CLA value
      const major = apduParser.extract8BitUInt();
      const minor = apduParser.extract8BitUInt();
      const patch = apduParser.extract8BitUInt();

      if (major === undefined || minor === undefined || patch === undefined) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Cannot extract version"),
        });
      }

      return CommandResultFactory({ data: { major, minor, patch } });
    });
  }
}
