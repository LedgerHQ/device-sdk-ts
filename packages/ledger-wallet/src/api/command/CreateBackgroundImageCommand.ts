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

export type CreateBackgroundImageArgs = {
  /**
   * The size of the image data in bytes.
   */
  readonly imageSize: number;
};

export type CreateBackgroundImageErrorCodes = "5501" | "5502" | "662f";

const CREATE_BACKGROUND_IMAGE_ERRORS: CommandErrors<CreateBackgroundImageErrorCodes> =
  {
    "5501": { message: "User refused on device" },
    "5502": { message: "PIN not validated" },
    "662f": { message: "Device is in recovery mode" },
  };

export class CreateBackgroundImageCommandError extends DeviceExchangeError<CreateBackgroundImageErrorCodes> {
  constructor({
    message,
    errorCode,
  }: CommandErrorArgs<CreateBackgroundImageErrorCodes>) {
    super({ tag: "CreateBackgroundImageCommandError", message, errorCode });
  }
}

export type CreateBackgroundImageCommandResult = CommandResult<
  void,
  CreateBackgroundImageErrorCodes
>;

/**
 * Command to create a custom image slot on the device.
 * This initiates the custom lock screen image loading process.
 * The user must approve this action on the device.
 */
export class CreateBackgroundImageCommand
  implements
    Command<void, CreateBackgroundImageArgs, CreateBackgroundImageErrorCodes>
{
  readonly name = "createBackgroundImage";
  readonly args: CreateBackgroundImageArgs;

  constructor(args: CreateBackgroundImageArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    const apduArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x60,
      p1: 0x00,
      p2: 0x00,
    };

    return new ApduBuilder(apduArgs)
      .add32BitUIntToData(this.args.imageSize)
      .build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<void, CreateBackgroundImageErrorCodes> {
    if (CommandUtils.isSuccessResponse(apduResponse)) {
      return CommandResultFactory({
        data: undefined,
      });
    }

    const parser = new ApduParser(apduResponse);
    const errorCode = parser.encodeToHexaString(apduResponse.statusCode);

    if (isCommandErrorCode(errorCode, CREATE_BACKGROUND_IMAGE_ERRORS)) {
      return CommandResultFactory({
        error: new CreateBackgroundImageCommandError({
          ...CREATE_BACKGROUND_IMAGE_ERRORS[errorCode],
          errorCode,
        }),
      });
    }

    return CommandResultFactory({
      error: GlobalCommandErrorHandler.handle(apduResponse),
    });
  }
}
