import {
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";
import { SignActionsCommand } from "@internal/app-binder/command/SignActionsCommand";
import { type HyperliquidErrorCodes } from "@internal/app-binder/command/utils/hyperliquidApplicationErrors";

export type SignActionsTaskArgs = {
  derivationPath: string;
};

export class SignActionsTask {
  constructor(
    private api: InternalApi,
    private args: SignActionsTaskArgs,
  ) {}

  async run(): Promise<CommandResult<Signature[], HyperliquidErrorCodes>> {
    const result = await this.signAction();

    // if (!isSuccessCommandResult(result)) {
    //   return result;
    // }

    return result;
  }

  private async signAction(
    signatures?: Signature[],
  ): Promise<CommandResult<Signature[], HyperliquidErrorCodes>> {
    const result = await this.api.sendCommand(
      new SignActionsCommand(this.args),
    );

    if (!isSuccessCommandResult(result)) {
      return result;
    }

    const nextSignatures = signatures
      ? [...signatures, result.data.signature]
      : [result.data.signature];

    if (result.data.signaturesLeft !== 0) {
      return await this.signAction(nextSignatures);
    } else {
      return CommandResultFactory({
        data: nextSignatures,
      });
    }
  }
}
