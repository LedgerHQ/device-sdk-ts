import {
  type Apdu,
  ApduParser,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
} from "@ledgerhq/device-management-kit";
import { ApduBuilder } from "@ledgerhq/device-management-kit";

import { type AppConfig } from "@api/model/AppConfig";
import {
  COSMOS_APP_ERRORS,
  CosmosAppCommandError,
  CosmosErrorCodes,
} from "@internal/app-binder/command/utils/CosmosApplicationErrors";

export type GetAppConfigCommandResponse = AppConfig;

export class GetAppConfigCommand
  implements Command<GetAppConfigCommandResponse, void, CosmosErrorCodes>
{
  readonly name = "GetAppConfig";

  getApdu(): Apdu {
    return new ApduBuilder({
      cla: 0x55,
      ins: 0x00,
      p1: 0x00,
      p2: 0x00,
    }).build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<GetAppConfigCommandResponse, CosmosErrorCodes> {
    const apduParser = new ApduParser(apduResponse);
    const statusCode = apduParser.encodeToHexaString(
      apduResponse.statusCode,
      true,
    );

    if (statusCode in COSMOS_APP_ERRORS) {
      const errorStatusCode = statusCode as CosmosErrorCodes;
      return CommandResultFactory({
        error: new CosmosAppCommandError({
          ...COSMOS_APP_ERRORS[errorStatusCode],
          errorCode: errorStatusCode,
        }),
      });
    }

    apduParser.extract8BitUInt(); // Skip CLA value
    const major = apduParser.extract8BitUInt();
    const minor = apduParser.extract8BitUInt();
    const patch = apduParser.extract8BitUInt();

    if (major === undefined || minor === undefined || patch === undefined) {
      return CommandResultFactory({
        error: new CosmosAppCommandError({
          message: COSMOS_APP_ERRORS[CosmosErrorCodes.DATA_INVALID].message,
          errorCode: CosmosErrorCodes.DATA_INVALID,
        }),
      });
    }
    return CommandResultFactory({ data: { major, minor, patch } });
  }
}
