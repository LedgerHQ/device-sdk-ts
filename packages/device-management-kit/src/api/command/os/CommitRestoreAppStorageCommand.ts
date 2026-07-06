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

export type CommitRestoreAppStorageCommandErrorCodes =
  | "5123"
  | "5419"
  | "541b"
  | "662f"
  | "6734";

export const COMMIT_RESTORE_APP_STORAGE_ERRORS: CommandErrors<CommitRestoreAppStorageCommandErrorCodes> =
  {
    "5123": { message: "Invalid context, restore init must be called first." },
    "5419": { message: "Internal error, crypto operation failed." },
    "541b": { message: "Failed to verify backup authenticity." },
    "662f": { message: "Invalid device state, recovery mode." },
    "6734": { message: "Invalid size of the restored app storage." },
  };

export class CommitRestoreAppStorageCommandError extends DeviceExchangeError<CommitRestoreAppStorageCommandErrorCodes> {
  constructor(
    args: CommandErrorArgs<CommitRestoreAppStorageCommandErrorCodes>,
  ) {
    super({ tag: "CommitRestoreAppStorageCommandError", ...args });
  }
}

export type CommitRestoreAppStorageCommandResult = CommandResult<
  void,
  CommitRestoreAppStorageCommandErrorCodes
>;

export class CommitRestoreAppStorageCommand
  implements Command<void, void, CommitRestoreAppStorageCommandErrorCodes>
{
  readonly name = "CommitRestoreAppStorage";

  private readonly header = {
    cla: 0xe0,
    ins: 0x6e,
    p1: 0x00,
    p2: 0x00,
  };

  getApdu(): Apdu {
    return new ApduBuilder(this.header).build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommitRestoreAppStorageCommandResult {
    const parser = new ApduParser(apduResponse);
    if (!CommandUtils.isSuccessResponse(apduResponse)) {
      const errorCode = parser.encodeToHexaString(apduResponse.statusCode);
      if (isCommandErrorCode(errorCode, COMMIT_RESTORE_APP_STORAGE_ERRORS)) {
        return CommandResultFactory({
          error: new CommitRestoreAppStorageCommandError({
            ...COMMIT_RESTORE_APP_STORAGE_ERRORS[errorCode],
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
