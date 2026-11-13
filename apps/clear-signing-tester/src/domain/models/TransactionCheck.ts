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
 * The line the Solana app adds to the first review page once a valid report
 * reached the device, one per risk level: benign, warning, malicious.
 */
export const TRANSACTION_CHECK_VERDICTS: readonly string[] = [
  "No threat detected by Transaction Check",
  "Potential risk detected",
  "Critical threat detected",
];

/**
 * What the Solana app shows instead of a verdict when Transaction Check is on
 * but no valid report reached the device: none was sent, its signature did not
 * verify, or it was for another transaction, signer or chain.
 */
export const TRANSACTION_CHECK_UNAVAILABLE = "Transaction Check unavailable";
