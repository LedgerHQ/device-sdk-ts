import { type Apdu } from "@api/apdu/model/Apdu";
import { ApduBuilder } from "@api/apdu/utils/ApduBuilder";
import { ApduParser } from "@api/apdu/utils/ApduParser";
import { type Command } from "@api/command/Command";
import { InvalidStatusWordError } from "@api/command/Errors";
import {
  type CommandResult,
  CommandResultFactory,
} from "@api/command/model/CommandResult";
import { isCommandErrorCode } from "@api/command/utils/CommandErrors";
import { type CommandErrors } from "@api/command/utils/CommandErrors";
import { CommandUtils } from "@api/command/utils/CommandUtils";
import { GlobalCommandErrorHandler } from "@api/command/utils/GlobalCommandError";
import { type ApduResponse } from "@api/device-session/ApduResponse";
import { type CommandErrorArgs, DeviceExchangeError } from "@api/Error";

export type GetAppStorageInfoCommandArgs = {
  appName: string;
};

export type GetAppStorageInfoCommandResponse = {
  storageSize: number;
  storageVersion: string;
  hasSettings: boolean;
  hasData: boolean;
  storageHash: string;
};

export type GetAppStorageInfoCommandErrorCodes = "5123" | "662f" | "670a";

export const GET_APP_STORAGE_INFO_ERRORS: CommandErrors<GetAppStorageInfoCommandErrorCodes> =
  {
    "5123": { message: "Application not found." },
    "662f": { message: "Device is in recovery mode." },
    "670a": { message: "Invalid application name length, two chars minimum." },
  };

export class GetAppStorageInfoCommandError extends DeviceExchangeError<GetAppStorageInfoCommandErrorCodes> {
  constructor(args: CommandErrorArgs<GetAppStorageInfoCommandErrorCodes>) {
    super({ tag: "GetAppStorageInfoCommandError", ...args });
  }
}

export type GetAppStorageInfoCommandResult = CommandResult<
  GetAppStorageInfoCommandResponse,
  GetAppStorageInfoCommandErrorCodes
>;

export class GetAppStorageInfoCommand
  implements
    Command<
      GetAppStorageInfoCommandResponse,
      GetAppStorageInfoCommandArgs,
      GetAppStorageInfoCommandErrorCodes
    >
{
  readonly name = "GetAppStorageInfo";

  private readonly header = {
    cla: 0xe0,
    ins: 0x6a,
    p1: 0x00,
    p2: 0x00,
  };

  constructor(private readonly args: GetAppStorageInfoCommandArgs) {}

  getApdu(): Apdu {
    const { appName } = this.args;
    return new ApduBuilder(this.header).addAsciiStringToData(appName).build();
  }

  parseResponse(apduResponse: ApduResponse): GetAppStorageInfoCommandResult {
    const parser = new ApduParser(apduResponse);
    if (!CommandUtils.isSuccessResponse(apduResponse)) {
      const errorCode = parser.encodeToHexaString(apduResponse.statusCode);
      if (isCommandErrorCode(errorCode, GET_APP_STORAGE_INFO_ERRORS)) {
        return CommandResultFactory({
          error: new GetAppStorageInfoCommandError({
            ...GET_APP_STORAGE_INFO_ERRORS[errorCode],
            errorCode,
          }),
        });
      }
      return CommandResultFactory({
        error: GlobalCommandErrorHandler.handle(apduResponse),
      });
    }

    const appStorageSize = parser.extract32BitUInt();
    if (appStorageSize === undefined) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("Failed to extract app storage size"),
      });
    }

    let appStorageVersion = "";
    let hasAppStorageSettings = false;
    let hasAppStorageData = false;
    let hash = "";

    if (appStorageSize !== 0) {
      const appStorageVersionNumber = parser.extract32BitUInt();
      if (appStorageVersionNumber === undefined) {
        return CommandResultFactory({
          error: new InvalidStatusWordError(
            "Failed to extract app storage version",
          ),
        });
      }
      appStorageVersion = appStorageVersionNumber.toString(16);
      /**
       * The properties byte is a bitfield with the following structure:
       * - Bit 0: hasSettings
       * - Bit 1: hasData
       */
      const appStorageProperties = parser.extract16BitUInt();
      if (appStorageProperties === undefined) {
        return CommandResultFactory({
          error: new InvalidStatusWordError(
            "Failed to extract app storage properties",
          ),
        });
      }

      hasAppStorageSettings = (appStorageProperties & 1) === 1;
      hasAppStorageData = (appStorageProperties & 2) === 2;
      hash = parser.encodeToHexaString(parser.extractFieldByLength(0x20));
    }

    return CommandResultFactory({
      data: {
        storageSize: appStorageSize,
        storageVersion: appStorageVersion,
        hasSettings: hasAppStorageSettings,
        hasData: hasAppStorageData,
        storageHash: hash,
      },
    });
  }
}
