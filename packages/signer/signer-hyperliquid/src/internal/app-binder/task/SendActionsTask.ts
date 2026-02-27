import {
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";

import { SendActionCommand } from "@internal/app-binder/command/SendActionCommand";
import { type HyperliquidErrorCodes } from "@internal/app-binder/command/utils/hyperliquidApplicationErrors";
import type { HyperliquidAction } from "@internal/app-binder/utils/actionTlvSerializer";
import { serializeActionToTlv } from "@internal/app-binder/utils/actionTlvSerializer";

export type SendActionsTaskArgs = {
  actions: HyperliquidAction[];
};

/**
 * Sends a list of actions to the device by serializing each action to TLV
 * (specs.md "Set action to sign") and calling SendActionCommand in sequence.
 * No derivation path: only the action list is sent.
 */
export class SendActionsTask {
  constructor(
    private api: InternalApi,
    private args: SendActionsTaskArgs,
  ) {}

  async run(): Promise<CommandResult<void, HyperliquidErrorCodes>> {
    const { actions } = this.args;

    for (const action of actions) {
      const serialized = serializeActionToTlv(action);
      const result = await this.api.sendCommand(
        new SendActionCommand({ serializedAction: serialized }),
      );

      if (!isSuccessCommandResult(result)) {
        return result;
      }
    }

    return CommandResultFactory({ data: undefined });
  }
}
