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
  CREATE_BACKGROUND_IMAGE_ERRORS,
  type CreateBackgroundImageErrorCodes,
  createBackgroundImageErrorFactory,
} from "./BackgroundImageCommandErrors";

export type CreateBackgroundImageArgs = {
  /**
   * The size of the image data in bytes.
   */
  readonly imageSize: number;
};

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

  constructor(
    args: CreateBackgroundImageArgs,
    private readonly _errorHelper = new CommandErrorHelper<
      void,
      CreateBackgroundImageErrorCodes
    >(CREATE_BACKGROUND_IMAGE_ERRORS, createBackgroundImageErrorFactory),
  ) {
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
    response: ApduResponse,
  ): CommandResult<void, CreateBackgroundImageErrorCodes> {
    return Maybe.fromNullable(
      this._errorHelper.getError(response),
    ).orDefaultLazy(() =>
      CommandResultFactory({
        data: undefined,
      }),
    );
  }
}
