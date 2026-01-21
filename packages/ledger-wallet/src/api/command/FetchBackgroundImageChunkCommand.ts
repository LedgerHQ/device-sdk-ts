import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  ApduParser,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";
import { CommandErrorHelper } from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import {
  FETCH_BACKGROUND_IMAGE_CHUNK_ERRORS,
  type FetchBackgroundImageChunkErrorCodes,
  fetchBackgroundImageChunkErrorFactory,
} from "./BackgroundImageCommandErrors";

export type FetchBackgroundImageChunkArgs = {
  /**
   * The offset in bytes from where to start reading.
   */
  readonly offset: number;
  /**
   * The number of bytes to read.
   * Max size is 238 bytes (240 - 2 bytes for status).
   */
  readonly length: number;
};

export type FetchBackgroundImageChunkResponse = {
  /**
   * The chunk data fetched from the device.
   */
  readonly data: Uint8Array;
};

export type FetchBackgroundImageChunkCommandResult = CommandResult<
  FetchBackgroundImageChunkResponse,
  FetchBackgroundImageChunkErrorCodes
>;

/**
 * Command to fetch a chunk of the custom lock screen image from the device.
 * This command is called repeatedly to fetch the entire image in chunks.
 * Max chunk size is 238 bytes (APDU response max 240 - 2 bytes for status).
 */
export class FetchBackgroundImageChunkCommand
  implements
    Command<
      FetchBackgroundImageChunkResponse,
      FetchBackgroundImageChunkArgs,
      FetchBackgroundImageChunkErrorCodes
    >
{
  readonly name = "fetchBackgroundImageChunk";
  readonly args: FetchBackgroundImageChunkArgs;

  constructor(
    args: FetchBackgroundImageChunkArgs,
    private readonly _errorHelper = new CommandErrorHelper<
      FetchBackgroundImageChunkResponse,
      FetchBackgroundImageChunkErrorCodes
    >(
      FETCH_BACKGROUND_IMAGE_CHUNK_ERRORS,
      fetchBackgroundImageChunkErrorFactory,
    ),
  ) {
    this.args = args;
  }

  getApdu(): Apdu {
    const apduArgs: ApduBuilderArgs = {
      cla: 0xe0,
      ins: 0x65,
      p1: 0x00,
      p2: 0x00,
    };

    return new ApduBuilder(apduArgs)
      .add32BitUIntToData(this.args.offset)
      .add8BitUIntToData(this.args.length)
      .build();
  }

  parseResponse(
    response: ApduResponse,
  ): CommandResult<
    FetchBackgroundImageChunkResponse,
    FetchBackgroundImageChunkErrorCodes
  > {
    return Maybe.fromNullable(
      this._errorHelper.getError(response),
    ).orDefaultLazy(() => {
      const parser = new ApduParser(response);
      const remainingLength = parser.getUnparsedRemainingLength();

      if (remainingLength === 0) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("No data received from device"),
        });
      }

      const data = parser.extractFieldByLength(remainingLength);

      if (data === undefined) {
        return CommandResultFactory({
          error: new InvalidStatusWordError("Failed to extract chunk data"),
        });
      }

      return CommandResultFactory({
        data: { data },
      });
    });
  }
}
