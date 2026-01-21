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

export type RemoveBackgroundImageErrorCodes =
  | "5501"
  | "5502"
  | "6621"
  | "662e"
  | "662f";

const REMOVE_BACKGROUND_IMAGE_ERRORS: CommandErrors<RemoveBackgroundImageErrorCodes> =
  {
    "5501": { message: "User refused on device" },
    "5502": { message: "PIN not validated" },
    "6621": { message: "Internal registry error" },
    "662e": { message: "No background image loaded on device" },
    "662f": { message: "Device is in recovery mode" },
  };

export class RemoveBackgroundImageCommandError extends DeviceExchangeError<RemoveBackgroundImageErrorCodes> {
  constructor({
    message,
    errorCode,
  }: CommandErrorArgs<RemoveBackgroundImageErrorCodes>) {
    super({ tag: "RemoveBackgroundImageCommandError", message, errorCode });
  }
}

export type RemoveBackgroundImageCommandResult = CommandResult<
  void,
  RemoveBackgroundImageErrorCodes
>;

/**
 * Command to remove the custom lock screen image from the device.
 * The user must approve this action on the device.
 */
export class RemoveBackgroundImageCommand
  implements Command<void, void, RemoveBackgroundImageErrorCodes>
{
  readonly name = "removeBackgroundImage";

  getApdu(): Apdu {
    const apduArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x63,
      p1: 0x00,
      p2: 0x00,
    };

    return new ApduBuilder(apduArgs).build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<void, RemoveBackgroundImageErrorCodes> {
    if (CommandUtils.isSuccessResponse(apduResponse)) {
      return CommandResultFactory({
        data: undefined,
      });
    }

    const parser = new ApduParser(apduResponse);
    const errorCode = parser.encodeToHexaString(apduResponse.statusCode);

    if (isCommandErrorCode(errorCode, REMOVE_BACKGROUND_IMAGE_ERRORS)) {
      return CommandResultFactory({
        error: new RemoveBackgroundImageCommandError({
          ...REMOVE_BACKGROUND_IMAGE_ERRORS[errorCode],
          errorCode,
        }),
      });
    }

    return CommandResultFactory({
      error: GlobalCommandErrorHandler.handle(apduResponse),
    });
  }
}
