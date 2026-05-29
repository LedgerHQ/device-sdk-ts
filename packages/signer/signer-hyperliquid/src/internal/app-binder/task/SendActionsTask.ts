import {
  type CommandResult,
  CommandResultFactory,
  type InternalApi,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { SendCommandInChunksTask } from "@ledgerhq/signer-utils";

import { SendActionCommand } from "@internal/app-binder/command/SendActionCommand";
import { type HyperliquidErrorCodes } from "@internal/app-binder/command/utils/hyperliquidApplicationErrors";
import type { HyperliquidAction } from "@internal/app-binder/di/appBinderTypes";
import { serializeActionToTlv } from "@internal/app-binder/utils/actionTlvSerializer";

export type SendActionsTaskArgs = {
  actions: HyperliquidAction[];
};

/**
 * Sends a list of actions to the device by serializing each action to TLV,
 * framing the result (0x00 + DER length + payload) and streaming it to the
 * device via the shared chunking task.
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
      const framed = buildSendActionPayload(serialized);

      const result = await new SendCommandInChunksTask<
        void,
        HyperliquidErrorCodes
      >(this.api, {
        data: framed,
        commandFactory: (chunkArgs) => new SendActionCommand(chunkArgs),
      }).run();

      if (!isSuccessCommandResult(result)) {
        return result;
      }
    }

    return CommandResultFactory({ data: undefined });
  }
}

/**
 * Frames a TLV-serialized action with the 2-byte big-endian length prefix
 * expected by the SET_ACTION first chunk (see app-hyperliquid spec).
 */
export function buildSendActionPayload(serialized: Uint8Array): Uint8Array {
  const length = serialized.length;
  const framed = new Uint8Array(2 + length);
  framed[0] = (length >> 8) & 0xff;
  framed[1] = length & 0xff;
  framed.set(serialized, 2);
  return framed;
}
