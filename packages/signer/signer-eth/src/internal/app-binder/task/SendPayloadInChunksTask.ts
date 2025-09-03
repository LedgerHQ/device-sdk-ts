import {
  type CommandResult,
  CommandResultFactory,
  hexaStringToBuffer,
  type InternalApi,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";

import { type EthErrorCodes } from "@internal/app-binder/command/utils/ethAppErrors";
import { PayloadUtils } from "@internal/shared/utils/PayloadUtils";

import {
  SendCommandInChunksTask,
  type SendCommandInChunksTaskArgs,
} from "./SendCommandInChunksTask";

export type SendPayloadInChunksTaskArgs<T> = {
  payload: string;
  commandFactory: SendCommandInChunksTaskArgs<T>["commandFactory"];
  withPayloadLength?: boolean;
};

export class SendPayloadInChunksTask<T> {
  constructor(
    private api: InternalApi,
    private args: SendPayloadInChunksTaskArgs<T>,
  ) {}
  async run(): Promise<CommandResult<T, EthErrorCodes>> {
    const { payload, withPayloadLength = true } = this.args;

    let data: Uint8Array | null = null;
    if (withPayloadLength) {
      data = PayloadUtils.getBufferFromPayload(payload);
    } else {
      data = hexaStringToBuffer(payload);
    }

    if (!data) {
      return CommandResultFactory({
        error: new InvalidStatusWordError("Invalid payload"),
      });
    }

    return new SendCommandInChunksTask(this.api, {
      data,
      commandFactory: this.args.commandFactory,
    }).run();
  }
}
