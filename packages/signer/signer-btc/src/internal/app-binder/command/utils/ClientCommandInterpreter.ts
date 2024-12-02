import { type InternalApi } from "@ledgerhq/device-management-kit";

import {
  type CommandHandler,
  type CommandHandlerContext,
} from "@internal/app-binder/command/clientCommandHandlers/ClientCommandHandlersTypes";
import { clientCommandsMap } from "@internal/app-binder/command/clientCommandHandlers/index";
import { type DataStore } from "@internal/data-store/model/DataStore";

import { ClientCommandCodes } from "./constants";

export class ClientCommandInterpreter {
  private commands: Map<ClientCommandCodes, CommandHandler>;
  private context: CommandHandlerContext;

  constructor(
    dataStore: DataStore,
    commands: Map<ClientCommandCodes, CommandHandler> = clientCommandsMap,
  ) {
    this.context = {
      dataStore,
      queue: [],
      yieldedResults: [],
    };
    this.commands = commands;
  }

  private getQueue(): Uint8Array[] {
    return this.context.queue;
  }

  private runHandler(request: Uint8Array): Uint8Array {
    const cmdCode = request[0];
    if (!cmdCode || !(cmdCode in ClientCommandCodes)) {
      // temp error
      throw new Error(`Unexpected command code ${cmdCode}`);
    }

    const handler = this.commands.get(cmdCode);
    if (!handler) {
      // temp error
      throw new Error(`Handler not implemented for ${cmdCode}`);
    }

    return handler.execute(request, this.context);
  }

  public getYieldedResults(): Uint8Array[] {
    return this.context.yieldedResults;
  }

  public async execute(
    api: InternalApi,
    initialRequest: Uint8Array,
  ): Promise<void> {
    //@ts-ignore
    const apduResponse = await api.sendCommand(initialRequest);
    //@ts-ignore
    this.runHandler(apduResponse);

    if (this.getQueue().length > 0) {
      const nextRequest = this.getQueue().shift();
      if (nextRequest) {
        //@ts-ignore
        await this.execute(api, nextRequest);
      }
    }
  }
}
