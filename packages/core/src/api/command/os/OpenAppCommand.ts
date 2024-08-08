import { Apdu } from "@api/apdu/model/Apdu";
import { ApduBuilder, ApduBuilderArgs } from "@api/apdu/utils/ApduBuilder";
import { ApduParser } from "@api/apdu/utils/ApduParser";
import { Command } from "@api/command/Command";
import {
  CommandResult,
  CommandResultFactory,
} from "@api/command/model/CommandResult";
import { CommandUtils } from "@api/command/utils/CommandUtils";
import {
  CommandErrors,
  GlobalCommandErrorHandler,
  GlobalCommandErrorStatusCode,
  isCommandErrorCode,
} from "@api/command/utils/GlobalCommandError";
import { ApduResponse } from "@api/device-session/ApduResponse";
import { CommandErrorArgs, DeviceExchangeError } from "@api/Error";

export type OpenAppArgs = {
  readonly appName: string;
};

export type OpenAppErrorCodes = "670a" | "6807";

const OPEN_APP_ERRORS: CommandErrors<OpenAppErrorCodes> = {
  "670a": { message: "No app name provided" },
  "6807": { message: "Unknown application name" },
};

export class OpenAppCommandError extends DeviceExchangeError<OpenAppErrorCodes> {
  constructor({ message, errorCode }: CommandErrorArgs<OpenAppErrorCodes>) {
    super({ tag: "OpenAppCommandError", message, errorCode });
  }
}

/**
 * The command to open an application on the device.
 */
export class OpenAppCommand
  implements
    Command<
      void,
      OpenAppErrorCodes | GlobalCommandErrorStatusCode,
      OpenAppArgs
    >
{
  readonly args: OpenAppArgs;

  readonly triggersDisconnection = true;

  constructor(args: OpenAppArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    const openAppApduArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0xd8,
      p1: 0x00,
      p2: 0x00,
    };
    return new ApduBuilder(openAppApduArgs)
      .addAsciiStringToData(this.args.appName)
      .build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<void, OpenAppErrorCodes | GlobalCommandErrorStatusCode> {
    if (CommandUtils.isSuccessResponse(apduResponse)) {
      return CommandResultFactory({
        data: undefined,
      });
    }
    const parser = new ApduParser(apduResponse);
    const errorCode = parser.encodeToHexaString(apduResponse.statusCode);
    if (isCommandErrorCode(errorCode, OPEN_APP_ERRORS)) {
      return CommandResultFactory({
        error: new OpenAppCommandError({
          ...OPEN_APP_ERRORS[errorCode],
          errorCode,
        }),
      });
    }
    return CommandResultFactory({
      error: GlobalCommandErrorHandler.handle(apduResponse),
    });
  }
}
