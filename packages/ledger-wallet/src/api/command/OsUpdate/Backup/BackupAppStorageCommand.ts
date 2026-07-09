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
  InvalidStatusWordError,
  isCommandErrorCode,
} from "@ledgerhq/device-management-kit";

export type BackupAppStorageCommandResponse = {
  chunkData: Uint8Array;
  chunkSize: number;
};

export type BackupAppStorageCommandErrorCodes =
  | "5123"
  | "5419"
  | "541a"
  | "541b"
  | "541c"
  | "622f"
  | "6642";

export const BACKUP_APP_STORAGE_ERRORS: CommandErrors<BackupAppStorageCommandErrorCodes> =
  {
    "5123": { message: "Invalid context. Get info must be called." },
    "5419": { message: "Failed to generate AES key." },
    "541a": { message: "Internal error, crypto operation failed." },
    "541b": { message: "Internal error, failed to compute AES CMAC." },
    "541c": { message: "Failed to encrypt the app storage backup." },
    "622f": { message: "Invalid device state, recovery mode." },
    "6642": { message: "Invalid backup state, backup already performed." },
  };

export class BackupAppStorageCommandError extends DeviceExchangeError<BackupAppStorageCommandErrorCodes> {
  constructor(args: CommandErrorArgs<BackupAppStorageCommandErrorCodes>) {
    super({ tag: "BackupAppStorageCommandError", ...args });
  }
}

export type BackupAppStorageCommandResult = CommandResult<
  BackupAppStorageCommandResponse,
  BackupAppStorageCommandErrorCodes
>;

export class BackupAppStorageCommand
  implements
    Command<
      BackupAppStorageCommandResponse,
      void,
      BackupAppStorageCommandErrorCodes
    >
{
  readonly name = "BackupAppStorage";

  private readonly header = {
    cla: 0xe0,
    ins: 0x6b,
    p1: 0x00,
    p2: 0x00,
  };

  getApdu(): Apdu {
    return new ApduBuilder(this.header).build();
  }

  parseResponse(apduResponse: ApduResponse): BackupAppStorageCommandResult {
    const parser = new ApduParser(apduResponse);

    if (!CommandUtils.isSuccessResponse(apduResponse)) {
      const errorCode = parser.encodeToHexaString(apduResponse.statusCode);
      if (isCommandErrorCode(errorCode, BACKUP_APP_STORAGE_ERRORS)) {
        return CommandResultFactory({
          error: new BackupAppStorageCommandError({
            ...BACKUP_APP_STORAGE_ERRORS[errorCode],
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
