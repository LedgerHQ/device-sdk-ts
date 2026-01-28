import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
} from "@ledgerhq/device-management-kit";
import { CommandErrorHelper } from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import {
  UPLOAD_BACKGROUND_IMAGE_CHUNK_ERRORS,
  type UploadBackgroundImageChunkErrorCodes,
  uploadBackgroundImageChunkErrorFactory,
} from "./BackgroundImageCommandErrors";

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

  constructor(
    args: UploadBackgroundImageChunkArgs,
    private readonly _errorHelper = new CommandErrorHelper<
      void,
      UploadBackgroundImageChunkErrorCodes
    >(
      UPLOAD_BACKGROUND_IMAGE_CHUNK_ERRORS,
      uploadBackgroundImageChunkErrorFactory,
    ),
  ) {
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
    response: ApduResponse,
  ): CommandResult<void, UploadBackgroundImageChunkErrorCodes> {
    return Maybe.fromNullable(
      this._errorHelper.getError(response),
    ).orDefaultLazy(() =>
      CommandResultFactory({
        data: undefined,
      }),
    );
  }
}
