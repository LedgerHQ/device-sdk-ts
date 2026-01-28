import {
  type Apdu,
  ApduBuilder,
  type ApduBuilderArgs,
  ApduParser,
  type ApduResponse,
  type Command,
  type CommandResult,
  CommandResultFactory,
} from "@ledgerhq/device-management-kit";
import { CommandErrorHelper } from "@ledgerhq/signer-utils";
import { Maybe } from "purify-ts";

import {
  GET_BACKGROUND_IMAGE_HASH_ERRORS,
  type GetBackgroundImageHashErrorCodes,
  getBackgroundImageHashErrorFactory,
} from "./BackgroundImageCommandErrors";

/**
 * Response containing the hash of the custom lock screen image.
 */
export type GetBackgroundImageHashResponse = {
  /**
   * The hash of the custom image as a hex string.
   */
  readonly hash: string;
};

export type GetBackgroundImageHashCommandResult = CommandResult<
  GetBackgroundImageHashResponse,
  GetBackgroundImageHashErrorCodes
>;

/**
 * Command to get the hash of the current custom lock screen image.
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

  constructor(
    private readonly _errorHelper = new CommandErrorHelper<
      GetBackgroundImageHashResponse,
      GetBackgroundImageHashErrorCodes
    >(GET_BACKGROUND_IMAGE_HASH_ERRORS, getBackgroundImageHashErrorFactory),
  ) {}

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
    response: ApduResponse,
  ): CommandResult<
    GetBackgroundImageHashResponse,
    GetBackgroundImageHashErrorCodes
  > {
    return Maybe.fromNullable(
      this._errorHelper.getError(response),
    ).orDefaultLazy(() => {
      const parser = new ApduParser(response);
      const hash = parser.encodeToHexaString(response.data);

      return CommandResultFactory({
        data: { hash },
      });
    });
  }
}
