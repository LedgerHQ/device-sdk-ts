import {
  type CommandResult,
  DmkResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";
import { SignPersonalMessageCommand } from "@internal/app-binder/command/SignPersonalMessageCommand";
import { encodeDerivationPath } from "@internal/app-binder/command/utils/encodeDerivationPath";
import { type TronAppErrorCodes } from "@internal/app-binder/command/utils/tronApplicationErrors";
import { serializePersonalMessage } from "@internal/app-binder/services/MessageSerializer";

type SignPersonalMessageTaskArgs = {
  derivationPath: string;
  message: Uint8Array;
};

export class SignPersonalMessageTask {
  constructor(
    private api: InternalApi,
    private args: SignPersonalMessageTaskArgs,
  ) {}

  async run(): Promise<CommandResult<Signature, TronAppErrorCodes>> {
    const { derivationPath, message } = this.args;

    const frames = serializePersonalMessage(
      encodeDerivationPath(derivationPath),
      message,
    );

    // Each frame is sent in order; the signature is returned on the final frame.
    let result: CommandResult<Signature, TronAppErrorCodes> = DmkResultFactory({
      error: new InvalidStatusWordError("No message frames to sign"),
    });

    for (const frame of frames) {
      result = await this.api.sendCommand(
        new SignPersonalMessageCommand({
          payload: frame.payload,
          p1: frame.p1,
        }),
      );

      if (!isSuccessCommandResult(result)) {
        return result;
      }
    }

    return result;
  }
}
