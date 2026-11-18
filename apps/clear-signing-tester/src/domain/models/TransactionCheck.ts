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

/**
 * The verdict lines the Solana app shows on its review. The trailing period
 * keeps the risk and threat warnings ("… Detected by Transaction_Checks") from
 * matching.
 */
export const TRANSACTION_CHECK_VERDICTS: readonly string[] = [
  "No threat detected by Transaction Check.",
  "Potential risk detected.",
  "Critical threat detected.",
];
