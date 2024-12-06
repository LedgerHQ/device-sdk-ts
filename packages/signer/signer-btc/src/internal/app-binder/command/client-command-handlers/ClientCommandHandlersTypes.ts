import { type DmkError } from "@ledgerhq/device-management-kit";
import { type Either } from "purify-ts";

import { type DataStore } from "@internal/data-store/model/DataStore";

export interface CommandHandlerContext {
  dataStore: DataStore;
  queue: Uint8Array[];
  yieldedResults: Uint8Array[];
}

export type ClientCommandContext = {
  dataStore: DataStore;
  queue: Uint8Array[];
  yieldedResults: Uint8Array[];
};

export type CommandHandler = (
  request: Uint8Array,
  context: ClientCommandContext,
) => Either<DmkError, Uint8Array>;
