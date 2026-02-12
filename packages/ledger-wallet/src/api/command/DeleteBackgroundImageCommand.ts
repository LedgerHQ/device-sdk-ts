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
  DELETE_BACKGROUND_IMAGE_ERRORS,
  type DeleteBackgroundImageErrorCodes,
  deleteBackgroundImageErrorFactory,
} from "./BackgroundImageCommandErrors";

export type DeleteBackgroundImageCommandResult = CommandResult<
  void,
  DeleteBackgroundImageErrorCodes
>;

/**
 * Command to delete the custom lock screen image from the device.
 * The user must approve this action on the device.
 */
export class DeleteBackgroundImageCommand
  implements Command<void, void, DeleteBackgroundImageErrorCodes>
{
  readonly name = "deleteBackgroundImage";

  constructor(
    private readonly _errorHelper = new CommandErrorHelper<
      void,
      DeleteBackgroundImageErrorCodes
    >(DELETE_BACKGROUND_IMAGE_ERRORS, deleteBackgroundImageErrorFactory),
  ) {}

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
    response: ApduResponse,
  ): CommandResult<void, DeleteBackgroundImageErrorCodes> {
    return Maybe.fromNullable(
      this._errorHelper.getError(response),
    ).orDefaultLazy(() =>
      CommandResultFactory({
        data: undefined,
      }),
    );
  }
}
