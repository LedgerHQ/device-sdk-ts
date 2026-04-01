import { type Apdu } from "@api/apdu/model/Apdu";
import { ApduBuilder } from "@api/apdu/utils/ApduBuilder";
import { ApduParser } from "@api/apdu/utils/ApduParser";
import { type Command } from "@api/command/Command";
import { InvalidStatusWordError } from "@api/command/Errors";
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

export type BackupStorageCommandResponse = {
  chunkData: Uint8Array;
  chunkSize: number;
};

export type BackupStorageCommandErrorCodes =
  | "5123"
  | "5419"
  | "541a"
  | "541b"
  | "541c"
  | "622f"
  | "6642";

export const BACKUP_STORAGE_ERRORS: CommandErrors<BackupStorageCommandErrorCodes> =
  {
    "5123": { message: "Invalid context. Get info must be called." },
    "5419": { message: "Failed to generate AES key." },
    "541a": { message: "Internal error, crypto operation failed." },
    "541b": { message: "Internal error, failed to compute AES CMAC." },
    "541c": { message: "Failed to encrypt the app storage backup." },
    "622f": { message: "Invalid device state, recovery mode." },
    "6642": { message: "Invalid backup state, backup already performed." },
  };

export class BackupStorageCommandError extends DeviceExchangeError<BackupStorageCommandErrorCodes> {
  constructor(args: CommandErrorArgs<BackupStorageCommandErrorCodes>) {
    super({ tag: "BackupStorageCommandError", ...args });
  }
}

export type BackupStorageCommandResult = CommandResult<
  BackupStorageCommandResponse,
  BackupStorageCommandErrorCodes
>;

export class BackupStorageCommand
  implements
    Command<BackupStorageCommandResponse, void, BackupStorageCommandErrorCodes>
{
  readonly name = "BackupStorage";

  private readonly header = {
    cla: 0xe0,
    ins: 0x6b,
    p1: 0x00,
    p2: 0x00,
  };

  getApdu(): Apdu {
    return new ApduBuilder(this.header).build();
  }

  parseResponse(apduResponse: ApduResponse): BackupStorageCommandResult {
    const parser = new ApduParser(apduResponse);

    if (!CommandUtils.isSuccessResponse(apduResponse)) {
      const errorCode = parser.encodeToHexaString(apduResponse.statusCode);
      if (isCommandErrorCode(errorCode, BACKUP_STORAGE_ERRORS)) {
        return CommandResultFactory({
          error: new BackupStorageCommandError({
            ...BACKUP_STORAGE_ERRORS[errorCode],
            errorCode,
          }),
        });
      }
      return CommandResultFactory({
        error: GlobalCommandErrorHandler.handle(apduResponse),
      });
    }

    const appStorageDataChunk = parser.extractFieldByLength(
      parser.getUnparsedRemainingLength(),
    );

    if (appStorageDataChunk === undefined) {
      return CommandResultFactory({
        error: new InvalidStatusWordError(
          "Failed to extract app storage data chunk",
        ),
      });
    }

    return CommandResultFactory({
      data: {
        chunkData: appStorageDataChunk,
        chunkSize: appStorageDataChunk.length,
      },
    });
  }
}
