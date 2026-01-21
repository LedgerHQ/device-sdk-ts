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
  COMMIT_BACKGROUND_IMAGE_ERRORS,
  type CommitBackgroundImageErrorCodes,
  commitBackgroundImageErrorFactory,
} from "./BackgroundImageCommandErrors";

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

  constructor(
    private readonly _errorHelper = new CommandErrorHelper<
      void,
      CommitBackgroundImageErrorCodes
    >(COMMIT_BACKGROUND_IMAGE_ERRORS, commitBackgroundImageErrorFactory),
  ) {}

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
    response: ApduResponse,
  ): CommandResult<void, CommitBackgroundImageErrorCodes> {
    return Maybe.fromNullable(
      this._errorHelper.getError(response),
    ).orDefaultLazy(() =>
      CommandResultFactory({
        data: undefined,
      }),
    );
  }
}
