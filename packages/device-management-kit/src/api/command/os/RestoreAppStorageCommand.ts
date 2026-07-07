import { type Apdu } from "@api/apdu/model/Apdu";
import { ApduBuilder } from "@api/apdu/utils/ApduBuilder";
import { ApduParser } from "@api/apdu/utils/ApduParser";
import { type Command } from "@api/command/Command";
import {
  type CommandResult,
  CommandResultFactory,
} from "@api/command/model/CommandResult";
import {
  type CommandErrors,
  isCommandErrorCode,
} from "@api/command/utils/CommandErrors";
import { CommandUtils } from "@api/command/utils/CommandUtils";
import { GlobalCommandErrorHandler } from "@api/command/utils/GlobalCommandError";
import { type ApduResponse } from "@api/device-session/ApduResponse";
import { type CommandErrorArgs, DeviceExchangeError } from "@api/Error";

export type RestoreAppStorageCommandArgs = {
  chunkData: Uint8Array;
};

export type RestoreAppStorageCommandErrorCodes =
  | "5123"
  | "5419"
  | "541a"
  | "662f"
  | "6643"
  | "6734"
  | "684a";

export const RESTORE_APP_STORAGE_ERRORS: CommandErrors<RestoreAppStorageCommandErrorCodes> =
  {
    "5123": { message: "Invalid context, Restore Init must be called first." },
    "5419": { message: "Failed to generate AES key." },
    "541a": { message: "Failed to decrypt the app storage backup." },
    "662f": { message: "Invalid device state, recovery mode." },
    "6643": { message: "Invalid restore state, restore already performed." },
    "6734": { message: "Invalid chunk length." },
    "684a": { message: "Invalid backup, app storage header is not valid." },
  };

export class RestoreAppStorageCommandError extends DeviceExchangeError<RestoreAppStorageCommandErrorCodes> {
  constructor(args: CommandErrorArgs<RestoreAppStorageCommandErrorCodes>) {
    super({ tag: "RestoreAppStorageCommandError", ...args });
  }
}

export type RestoreAppStorageCommandResult = CommandResult<
  void,
  RestoreAppStorageCommandErrorCodes
>;

export class RestoreAppStorageCommand
  implements
    Command<
      void,
      RestoreAppStorageCommandArgs,
      RestoreAppStorageCommandErrorCodes
    >
{
  readonly name = "RestoreAppStorage";

  private readonly header = {
    cla: 0xe0,
    ins: 0x6d,
    p1: 0x00,
    p2: 0x00,
  };

  constructor(private readonly args: RestoreAppStorageCommandArgs) {}

  getApdu(): Apdu {
    const { chunkData } = this.args;
    return new ApduBuilder(this.header).addBufferToData(chunkData).build();
  }

  parseResponse(apduResponse: ApduResponse): RestoreAppStorageCommandResult {
    const parser = new ApduParser(apduResponse);
    if (!CommandUtils.isSuccessResponse(apduResponse)) {
      const errorCode = parser.encodeToHexaString(apduResponse.statusCode);
      if (isCommandErrorCode(errorCode, RESTORE_APP_STORAGE_ERRORS)) {
        return CommandResultFactory({
          error: new RestoreAppStorageCommandError({
            ...RESTORE_APP_STORAGE_ERRORS[errorCode],
            errorCode,
          }),
        });
      }
      return CommandResultFactory({
        error: GlobalCommandErrorHandler.handle(apduResponse),
      });
    }

    return CommandResultFactory({
      data: undefined,
    });
  }
}
