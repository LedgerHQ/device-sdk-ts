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

/**
 * Response containing the hash of the custom lock screen image.
 * If no image is loaded, the hash will be an empty string.
 */
export type GetBackgroundImageHashResponse = {
  /**
   * The hash of the custom image as a hex string.
   * Empty string if no custom image is loaded.
   */
  readonly hash: string;
};

export type GetBackgroundImageHashErrorCodes = "662f";

const GET_BACKGROUND_IMAGE_HASH_ERRORS: CommandErrors<GetBackgroundImageHashErrorCodes> =
  {
    "662f": { message: "Device is in recovery mode" },
  };

export class GetBackgroundImageHashCommandError extends DeviceExchangeError<GetBackgroundImageHashErrorCodes> {
  constructor({
    message,
    errorCode,
  }: CommandErrorArgs<GetBackgroundImageHashErrorCodes>) {
    super({ tag: "GetBackgroundImageHashCommandError", message, errorCode });
  }
}

export type GetBackgroundImageHashCommandResult = CommandResult<
  GetBackgroundImageHashResponse,
  GetBackgroundImageHashErrorCodes
>;

/**
 * Command to get the hash of the current custom lock screen image.
 * Returns an empty hash if no image is loaded.
 */
export class GetBackgroundImageHashCommand
  implements
    Command<
      GetBackgroundImageHashResponse,
      void,
      GetBackgroundImageHashErrorCodes
    >
{
  readonly name = "getBackgroundImageHash";

  getApdu(): Apdu {
    const apduArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x66,
      p1: 0x00,
      p2: 0x00,
    };

    return new ApduBuilder(apduArgs).build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<
    GetBackgroundImageHashResponse,
    GetBackgroundImageHashErrorCodes
  > {
    const parser = new ApduParser(apduResponse);

    // Status code 0x662e means no image loaded - return empty hash
    const errorCode = parser.encodeToHexaString(apduResponse.statusCode);
    if (errorCode === "662e") {
      return CommandResultFactory({
        data: { hash: "" },
      });
    }

    if (!CommandUtils.isSuccessResponse(apduResponse)) {
      if (isCommandErrorCode(errorCode, GET_BACKGROUND_IMAGE_HASH_ERRORS)) {
        return CommandResultFactory({
          error: new GetBackgroundImageHashCommandError({
            ...GET_BACKGROUND_IMAGE_HASH_ERRORS[errorCode],
            errorCode,
          }),
        });
      }

      return CommandResultFactory({
        error: GlobalCommandErrorHandler.handle(apduResponse),
      });
    }

    // Parse the hash from the response data
    const hash = parser.encodeToHexaString(apduResponse.data);

    return CommandResultFactory({
      data: { hash },
    });
  }
}
