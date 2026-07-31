import {
  type Apdu,
  ApduBuilder,
  ApduParser,
  type ApduResponse,
  type Command,
  type CommandErrorArgs,
  type CommandErrors,
  type CommandResult,
  CommandResultFactory,
  CommandUtils,
  DeviceExchangeError,
  GlobalCommandErrorHandler,
  isCommandErrorCode,
} from "@ledgerhq/device-management-kit";

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
