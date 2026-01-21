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

export type UploadBackgroundImageChunkArgs = {
  /**
   * The offset in bytes where this chunk should be written.
   */
  readonly offset: number;
  /**
   * The chunk data to upload.
   * Max size is 251 bytes (255 - 4 bytes for offset).
   */
  readonly data: Uint8Array;
};

export type UploadBackgroundImageChunkErrorCodes =
  | "5106"
  | "551e"
  | "662f"
  | "6703"
  | "680b";

const UPLOAD_BACKGROUND_IMAGE_CHUNK_ERRORS: CommandErrors<UploadBackgroundImageChunkErrorCodes> =
  {
    "5106": {
      message: "Invalid state, create background image has not been called",
    },
    "551e": { message: "Image not created" },
    "662f": { message: "Device is in recovery mode" },
    "6703": { message: "APDU size is too small" },
    "680b": { message: "Invalid chunk offset or length" },
  };

export class UploadBackgroundImageChunkCommandError extends DeviceExchangeError<UploadBackgroundImageChunkErrorCodes> {
  constructor({
    message,
    errorCode,
  }: CommandErrorArgs<UploadBackgroundImageChunkErrorCodes>) {
    super({
      tag: "UploadBackgroundImageChunkCommandError",
      message,
      errorCode,
    });
  }
}

export type UploadBackgroundImageChunkCommandResult = CommandResult<
  void,
  UploadBackgroundImageChunkErrorCodes
>;

/**
 * Command to upload a chunk of the custom lock screen image data.
 * This command is called repeatedly to upload the entire image in chunks.
 * Max chunk size is 251 bytes (APDU max payload 255 - 4 bytes for offset).
 */
export class UploadBackgroundImageChunkCommand
  implements
    Command<
      void,
      UploadBackgroundImageChunkArgs,
      UploadBackgroundImageChunkErrorCodes
    >
{
  readonly name = "uploadBackgroundImageChunk";
  readonly args: UploadBackgroundImageChunkArgs;

  constructor(args: UploadBackgroundImageChunkArgs) {
    this.args = args;
  }

  getApdu(): Apdu {
    const apduArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x61,
      p1: 0x00,
      p2: 0x00,
    };

    return new ApduBuilder(apduArgs)
      .add32BitUIntToData(this.args.offset)
      .addBufferToData(this.args.data)
      .build();
  }

  parseResponse(
    apduResponse: ApduResponse,
  ): CommandResult<void, UploadBackgroundImageChunkErrorCodes> {
    if (CommandUtils.isSuccessResponse(apduResponse)) {
      return CommandResultFactory({
        data: undefined,
      });
    }

    const parser = new ApduParser(apduResponse);
    const errorCode = parser.encodeToHexaString(apduResponse.statusCode);

    if (isCommandErrorCode(errorCode, UPLOAD_BACKGROUND_IMAGE_CHUNK_ERRORS)) {
      return CommandResultFactory({
        error: new UploadBackgroundImageChunkCommandError({
          ...UPLOAD_BACKGROUND_IMAGE_CHUNK_ERRORS[errorCode],
          errorCode,
        }),
      });
    }

    return CommandResultFactory({
      error: GlobalCommandErrorHandler.handle(apduResponse),
    });
  }
}
