import { type SpeculinhoConfig } from "@root/src/domain/models/config/SpeculinhoConfig";

/** Device a scenario can run on. */
export type ScenarioDevice = SpeculinhoConfig["device"];

/** Coin app a scenario exercises. */
export type ScenarioCoinApp = "Ethereum" | "Solana";

/**
 * What a scenario asks the device to do. The action decides which flow runs;
 * the fixture or program decides what goes through it.
 */
export type ScenarioAction =
  | "signTransaction"
  | "signTypedData"
  | "registerContact"
  | "solanaProgram";

/** Per-scenario switches that used to be CLI flags on a bespoke script. */
export type ScenarioOptions = {
  /** Accept the blind-signing prompt instead of failing on it. */
  readonly blindSigningEnabled?: boolean;
  /** Send no origin token, so the device shows the gating screen. */
  readonly skipOriginToken?: boolean;
  /** Address book bound to the signer for the whole run. */
  readonly addressBook?: string;
  /** Distil program transactions to a single clear-signable instruction. */
  readonly distill?: boolean;
  /** Pull live transactions from the Solana RPC. */
  readonly useRpc?: boolean;
};

/**
 * One runnable case: a device, a coin app, an action, and its input.
 *
 * Scenarios are data so that selecting what to run is a lookup rather than a
 * new command, and so a device can run many of them against its own emulator.
 */
export type Scenario = {
  /** Unique selector, e.g. `core:complete`. */
  readonly name: string;
  /** Selectable family, e.g. `core`, `erc7730`, `gating`. */
  readonly group: string;
  /** Devices this scenario supports; a run picks one of them. */
  readonly devices: readonly ScenarioDevice[];
  readonly coinApp: ScenarioCoinApp;
  readonly action: ScenarioAction;
  /** Fixture path, for the file-driven actions. */
  readonly fixture?: string;
  /** Program name, for `solanaProgram`. */
  readonly program?: string;
  readonly options?: ScenarioOptions;
};

/** A scenario bound to one of its devices: the unit of work a runner takes. */
export type ScenarioRun = {
  readonly scenario: Scenario;
  readonly device: ScenarioDevice;
};
