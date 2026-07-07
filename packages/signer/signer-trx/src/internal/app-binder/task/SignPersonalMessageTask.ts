import {
  type CommandResult,
  type InternalApi,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";
import { SignPersonalMessageCommand } from "@internal/app-binder/command/SignPersonalMessageCommand";
import { type TronAppErrorCodes } from "@internal/app-binder/command/utils/tronApplicationErrors";

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
    // TODO: Adapt to Tron's message signing protocol
    return this.api.sendCommand(
      new SignPersonalMessageCommand({
        derivationPath: this.args.derivationPath,
        message: this.args.message,
      }),
    );
  }
}
