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

export type InitRestoreAppStorageCommandArgs = {
  appName: string;
  appStorageDataLength: number;
};

export type InitRestoreAppStorageCommandErrorCodes =
  | "5123"
  | "662f"
  | "5501"
  | "5502"
  | "670a"
  | "6733";

export const INIT_RESTORE_APP_STORAGE_ERRORS: CommandErrors<InitRestoreAppStorageCommandErrorCodes> =
  {
    "5123": { message: "Application not found." },
    "662f": { message: "Invalid device state, recovery mode." },
    "5501": { message: "Invalid consent, user rejected." },
    "5502": { message: "Invalid consent, pin is not set." },
    "670a": { message: "Invalid application name length, two chars minimum." },
    "6733": { message: "Invalid backup length value." },
  };

export class InitRestoreAppStorageCommandError extends DeviceExchangeError<InitRestoreAppStorageCommandErrorCodes> {
  constructor(args: CommandErrorArgs<InitRestoreAppStorageCommandErrorCodes>) {
    super({ tag: "InitRestoreAppStorageCommandError", ...args });
  }
}

export type InitRestoreAppStorageCommandResult = CommandResult<
  void,
  InitRestoreAppStorageCommandErrorCodes
>;

export class InitRestoreAppStorageCommand
  implements
    Command<
      void,
      InitRestoreAppStorageCommandArgs,
      InitRestoreAppStorageCommandErrorCodes
    >
{
  readonly name = "InitRestoreAppStorage";

  private readonly header = {
    cla: 0xe0,
    ins: 0x6c,
    p1: 0x00,
    p2: 0x00,
  };

  constructor(private readonly args: InitRestoreAppStorageCommandArgs) {}

  getApdu(): Apdu {
    const { appName, appStorageDataLength } = this.args;
    return new ApduBuilder(this.header)
      .add32BitUIntToData(appStorageDataLength)
      .addAsciiStringToData(appName)
      .build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): InitRestoreAppStorageCommandResult {
    const parser = new ApduParser(apduResponse);
    if (!CommandUtils.isSuccessResponse(apduResponse)) {
      const errorCode = parser.encodeToHexaString(apduResponse.statusCode);
      if (isCommandErrorCode(errorCode, INIT_RESTORE_APP_STORAGE_ERRORS)) {
        return CommandResultFactory({
          error: new InitRestoreAppStorageCommandError({
            ...INIT_RESTORE_APP_STORAGE_ERRORS[errorCode],
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
