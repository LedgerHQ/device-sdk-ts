import {
  type CommandHandler,
  type CommandHandlerContext,
} from "@internal/app-binder/command/clientCommandHandlers/ClientCommandHandlerTypes";
import { type DataStore } from "@internal/data-store/model/DataStore";

import { ClientCommandCodes } from "./constants";

export class ClientCommandInterpreter {
  private commands: Map<ClientCommandCodes, CommandHandler>;
  private context: CommandHandlerContext;

  constructor(
    dataStore: DataStore,
    commands: Map<ClientCommandCodes, CommandHandler>,
  ) {
    this.context = {
      dataStore,
      queue: [],
      yieldedResults: [],
    };
    this.commands = commands;
  }

  public getYieldedResults(): Uint8Array[] {
    return this.context.yieldedResults;
  }

  public getQueue(): Uint8Array[] {
    return this.context.queue;
  }

  public execute(request: Uint8Array): Uint8Array {
    const cmdCode = request[0];
    if (!cmdCode || !(cmdCode in ClientCommandCodes)) {
      //temp error
      throw new Error(`Unexpected command code ${cmdCode}`);
    }

    const handler = this.commands.get(cmdCode);
    if (!handler) {
      //temp error
      throw new Error(`Handler not implemented for ${cmdCode}`);
    }

    return handler.execute(request, this.context);
  }
}
