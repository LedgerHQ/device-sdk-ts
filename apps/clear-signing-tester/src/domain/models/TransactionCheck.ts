import { type ScenarioDevice } from "@root/src/domain/models/Scenario";

/**
 * Devices with Transaction Check. The signer never offers the opt-in on the
 * Nano models, so a scenario there would have no verdict to show.
 */
export const TRANSACTION_CHECK_DEVICES: readonly ScenarioDevice[] = [
  "stax",
  "flex",
  "apex",
];
