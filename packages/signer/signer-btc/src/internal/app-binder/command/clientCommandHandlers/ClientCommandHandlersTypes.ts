import { type DataStore } from "@internal/data-store/model/DataStore";

export interface CommandHandler {
  execute(request: Uint8Array, context: CommandHandlerContext): Uint8Array;
}

export interface CommandHandlerContext {
  dataStore: DataStore;
  queue: Uint8Array[];
  yieldedResults: Uint8Array[];
}
