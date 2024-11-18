import {
  type Apdu,
  ApduBuilder,
  ApduParser,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
  InvalidStatusWordError,
  isCommandErrorCode,
} from "@ledgerhq/device-management-kit";

import { type AppConfiguration } from "@api/model/AppConfiguration";
import { PublicKeyDisplayMode } from "@api/model/PublicKeyDisplayMode";

import {
  SolanaAppCommandError,
  solanaAppErrors,
} from "./utils/solanaAppErrors";

type GetAppConfigurationCommandArgs = void;

export class GetAppConfigurationCommand
  implements Command<AppConfiguration, GetAppConfigurationCommandArgs>
{
  args: GetAppConfigurationCommandArgs;

  constructor(args: GetAppConfigurationCommandArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    return new ApduBuilder({
      cla: 0xe0,
      ins: 0x04,
      p1: 0x00,
      p2: 0x00,
    }).build();
  }

  parseResponse(response: ApduResponse): CommandResult<AppConfiguration> {
    const parser = new ApduParser(response);
    const errorCode = parser.encodeToHexaString(response.statusCode);
    if (isCommandErrorCode(errorCode, solanaAppErrors)) {
      return CommandResultFactory({
        error: new SolanaAppCommandError({
          ...solanaAppErrors[errorCode],
          errorCode,
        }),
      });
    }

    const buffer = parser.extractFieldByLength(5);
    if (
      !buffer ||
      buffer.length !== 5 ||
      buffer.some((element) => element === undefined)
    ) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("Invalid response"),
      });
    }

    const config: AppConfiguration = {
      blindSigningEnabled: Boolean(buffer[0]),
      pubKeyDisplayMode:
        buffer[1] === 0
          ? PublicKeyDisplayMode.LONG
          : PublicKeyDisplayMode.SHORT,
      version: `${buffer[2]}.${buffer[3]}.${buffer[4]}`,
    };

    return CommandResultFactory({
      data: config,
    });
  }
}
