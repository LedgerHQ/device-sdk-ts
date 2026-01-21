import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
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

export type CommitBackgroundImageErrorCodes =
  | "5501"
  | "5502"
  | "551e"
  | "662f"
  | "681f"
  | "6820";

const COMMIT_BACKGROUND_IMAGE_ERRORS: CommandErrors<CommitBackgroundImageErrorCodes> =
  {
    "5501": { message: "User refused on device" },
    "5502": { message: "PIN not validated" },
    "551e": { message: "Image not created" },
    "662f": { message: "Device is in recovery mode" },
    "681f": { message: "Image metadata are not valid" },
    "6820": { message: "Invalid image size" },
  };

export class CommitBackgroundImageCommandError extends DeviceExchangeError<CommitBackgroundImageErrorCodes> {
  constructor({
    message,
    errorCode,
  }: CommandErrorArgs<CommitBackgroundImageErrorCodes>) {
    super({ tag: "CommitBackgroundImageCommandError", message, errorCode });
  }
}

export type CommitBackgroundImageCommandResult = CommandResult<
  void,
  CommitBackgroundImageErrorCodes
>;

/**
 * Command to commit the uploaded custom lock screen image.
 * This finalizes the image loading process.
 * The user must approve this action on the device.
 */
export class CommitBackgroundImageCommand
  implements Command<void, void, CommitBackgroundImageErrorCodes>
{
  readonly name = "commitBackgroundImage";

  getApdu(): Apdu {
    const apduArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x62,
      p1: 0x00,
      p2: 0x00,
    };

    return new ApduBuilder(apduArgs).build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<void, CommitBackgroundImageErrorCodes> {
    if (CommandUtils.isSuccessResponse(apduResponse)) {
      return CommandResultFactory({
        data: undefined,
      });
    }

    const parser = new ApduParser(apduResponse);
    const errorCode = parser.encodeToHexaString(apduResponse.statusCode);

    if (isCommandErrorCode(errorCode, COMMIT_BACKGROUND_IMAGE_ERRORS)) {
      return CommandResultFactory({
        error: new CommitBackgroundImageCommandError({
          ...COMMIT_BACKGROUND_IMAGE_ERRORS[errorCode],
          errorCode,
        }),
      });
    }

    return CommandResultFactory({
      error: GlobalCommandErrorHandler.handle(apduResponse),
    });
  }
}
