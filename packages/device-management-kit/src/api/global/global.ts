import { DefaultLoggerPublisherService } from "@api/global/services/logger/DefaultLoggerPublisherService";
import { type LoggerPublisherService } from "@api/global/services/logger/LoggerPublisherService";
import { type LoggerSubscriberService } from "@api/global/services/logger/LoggerSubscriberService";

export type LoggerService = {
  /** Returns a logger publishing to the registered subscribers under `tags`. */
  readonly getLogger: (...tags: string[]) => LoggerPublisherService;
  /** Replaces the subscribers. Called when a DMK is built. */
  readonly setSubscribers: (subscribers: LoggerSubscriberService[]) => void;
};

export type DmkContext = {
  readonly version: "v1";
  readonly service: {
    readonly logger: LoggerService;
  };
};

// The version is in the key so that an incompatible context gets its own slot.
const CTX_KEY = Symbol.for("@ledgerhq/device-management-kit/ctx/v1");

const createContext = (): DmkContext => {
  // Mutated in place, never reassigned: loggers keep a reference to it.
  const subscribers: LoggerSubscriberService[] = [];
  return {
    version: "v1",
    service: {
      logger: {
        getLogger: (...tags) =>
          new DefaultLoggerPublisherService(subscribers, tags),
        setSubscribers: (next) => {
          subscribers.splice(0, subscribers.length, ...next);
        },
      },
    },
  };
};

const store = globalThis as { [CTX_KEY]?: DmkContext };

if (store[CTX_KEY]) {
  console.error(
    "[DMK] The global context is registered twice: several copies of @ledgerhq/device-management-kit are loaded. They share the first one.",
  );
}

/** DMK services shared with every layer (transports, signers, context module, apps). */
export const ctx: DmkContext = (store[CTX_KEY] ??= createContext());
