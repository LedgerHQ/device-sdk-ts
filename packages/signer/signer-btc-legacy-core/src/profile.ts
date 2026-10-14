import { type LegacyErrorConfig } from "./errors";

/**
 * What differs between the coins that speak the legacy protocol. The core
 * commands read it instead of hard-coding one coin.
 */
export type LegacyCoinProfile<ErrorCodes extends string> = {
  /** Name of the device app, as the OS reports it. */
  appName: string;
  /** Error mapping for every command sent to this app. */
  errors: LegacyErrorConfig<ErrorCodes>;
  /** P2 of the first "untrusted hash start" (0x44) of a new transaction. */
  newTransactionP2: number;
};
