import {
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";
import { SignActionsCommand } from "@internal/app-binder/command/SignActionsCommand";
import { type HyperliquidErrorCodes } from "@internal/app-binder/command/utils/hyperliquidApplicationErrors";

type SignActionsTaskArgs = {
  derivationPath: string;
  Actions: Uint8Array;
};

export class SignActionsTask {
  constructor(
    private api: InternalApi,
    private args: SignActionsTaskArgs,
  ) {}

  async run(): Promise<CommandResult<Signature, HyperliquidErrorCodes>> {
    // TODO: Adapt this implementation to your blockchain's signing protocol
    // For Actionss larger than a single APDU, you may need to:
    // 1. Split the Actions into chunks
    // 2. Send each chunk with appropriate first/continue flags
    // 3. Collect the final signature from the last response

    const result = await this.api.sendCommand(
      new SignActionsCommand({
        derivationPath: this.args.derivationPath,
        Actions: this.args.Actions,
      }),
    );

    if (!isSuccessCommandResult(result)) {
      return result;
    }

    return CommandResultFactory({
      data: result.data.signature,
    });
  }
}
