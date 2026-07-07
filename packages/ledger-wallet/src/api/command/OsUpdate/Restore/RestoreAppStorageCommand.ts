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
