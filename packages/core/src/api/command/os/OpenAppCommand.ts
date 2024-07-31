import { Apdu } from "@api/apdu/model/Apdu";
import { ApduBuilder, ApduBuilderArgs } from "@api/apdu/utils/ApduBuilder";
import { ApduParser } from "@api/apdu/utils/ApduParser";
import { Command } from "@api/command/Command";
import { GlobalErrorHandler } from "@api/command/Errors";
import {
  CommandResult,
  CommandResultStatus,
} from "@api/command/model/CommandResult";
import { CommandUtils } from "@api/command/utils/CommandUtils";
import { ApduResponse } from "@api/device-session/ApduResponse";
import {
  CommandErrors,
  DeviceExchangeError,
  GlobalCommandErrorStatusCode,
  isCommandErrorCode,
} from "@api/Error";

export type OpenAppArgs = {
  readonly appName: string;
};

type OpenAppErrorCodes = "670A" | "6807";

const OPEN_APP_ERRORS: CommandErrors<OpenAppErrorCodes> = {
  "670A": { message: "No app name provided" },
  "6807": { message: "Unknown application name" },
};

class OpenAppCommandError extends DeviceExchangeError<OpenAppErrorCodes> {
  override readonly _tag = "OpenAppCommandError";
  constructor({
    message,
    errorCode,
  }: {
    message: string;
    errorCode: OpenAppErrorCodes;
  }) {
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
      OpenAppArgs,
      OpenAppErrorCodes | GlobalCommandErrorStatusCode
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
      return {
        status: CommandResultStatus.Success,
        data: void 0,
      };
    }
    const parser = new ApduParser(apduResponse);
    const errorCode = parser.encodeToHexaString(apduResponse.statusCode);
    if (isCommandErrorCode(errorCode, OPEN_APP_ERRORS)) {
      return {
        status: CommandResultStatus.Error,
        error: new OpenAppCommandError({
          ...OPEN_APP_ERRORS[errorCode],
          errorCode,
        }),
      };
    }
    return {
      status: CommandResultStatus.Error,
      error: GlobalErrorHandler.handle(apduResponse),
    };
  }
}
