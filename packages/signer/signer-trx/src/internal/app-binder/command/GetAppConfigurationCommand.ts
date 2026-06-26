import {
  type Apdu,
  type ApduResponse,
  type Command,
  type CommandResult,
} from "@ledgerhq/device-management-kit";

import { type AppConfiguration } from "@api/model/AppConfiguration";

import { type TronAppErrorCodes } from "./utils/tronApplicationErrors";

export type GetAppConfigurationCommandArgs = void;

export type GetAppConfigurationCommandResponse = AppConfiguration;

export class GetAppConfigurationCommand
  implements
    Command<
      GetAppConfigurationCommandResponse,
      GetAppConfigurationCommandArgs,
      TronAppErrorCodes
    >
{
  readonly name = "GetAppConfiguration";

  readonly args: GetAppConfigurationCommandArgs = undefined;

  getApdu(): Apdu {
    // TODO: Implement APDU construction
    throw new Error("GetAppConfigurationCommand.getApdu() not implemented");
  }

  parseResponse(
    _apduResponse: ApduResponse,
  ): CommandResult<GetAppConfigurationCommandResponse, TronAppErrorCodes> {
    // TODO: Implement response parsing
    throw new Error(
      "GetAppConfigurationCommand.parseResponse() not implemented",
    );
  }
}
