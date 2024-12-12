import {
  ApduBuilder,
  ApduParser,
  type ApduResponse,
  type CommandResult,
  CommandResultFactory,
  CommandUtils,
} from "@ledgerhq/device-management-kit";
import { Just, type Maybe, Nothing } from "purify-ts";

import {
  NearAppCommand,
  type NearAppErrorCodes,
} from "@internal/app-binder/command/NearAppCommand";

type SignDelegateCommandResponse = Maybe<Uint8Array>;

type SignDelegateCommandArgs = {
  isLastChunk: boolean;
  data: Uint8Array;
};

export class SignDelegateCommand extends NearAppCommand<
  SignDelegateCommandResponse,
  SignDelegateCommandArgs
> {
  constructor(readonly args: SignDelegateCommandArgs) {
    super();
  }
  override getApdu() {
    const { data, isLastChunk } = this.args;

    return new ApduBuilder({
      cla: 0x80,
      ins: 0x08,
      p1: isLastChunk ? 0x80 : 0x00,
      p2: "W".charCodeAt(0),
    })
      .addBufferToData(data)
      .build();
  }

  override parseResponse(
    response: ApduResponse,
  ): CommandResult<SignDelegateCommandResponse, NearAppErrorCodes> {
    if (!CommandUtils.isSuccessResponse(response)) {
      return this._getError(response, new ApduParser(response));
    }
    if (!this.args.isLastChunk) {
      return CommandResultFactory({
        data: Nothing,
      });
    }
    return CommandResultFactory({
      data: Just(response.data),
    });
  }
}
