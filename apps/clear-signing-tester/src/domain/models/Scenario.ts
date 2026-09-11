import { type SpeculinhoConfig } from "@root/src/domain/models/config/SpeculinhoConfig";

/** Device a scenario can run on. */
export type ScenarioDevice = SpeculinhoConfig["device"];

/**
 * Every device a scenario may name. Listed once so a scenario file and
 * `--device` cannot accept different sets.
 */
export const SCENARIO_DEVICES: readonly ScenarioDevice[] = [
  "stax",
  "nanox",
  "nanos",
  "nanos+",
  "flex",
  "apex",
];

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
  /**
   * Versions this scenario needs, overriding the device's pin in default_versions.json.
   * For a feature that only exists in a pre-release build, while everything else
   * on the device stays on the stable pair.
   */
  readonly osVersion?: string;
  readonly appVersion?: string;
  /**
   * Set when the cases depend on each other, so the whole fixture must run on
   * one device in order. Independent cases are the default and are spread over
   * as many emulators as the concurrency allows.
   */
  readonly sequential?: boolean;
  /**
   * `false` keeps the scenario out of every selection, for cases kept in the
   * repo but not run — an alternate chain nobody wired up, a descriptor known
   * to be broken. Absent means enabled.
   */
  readonly enabled?: boolean;
};

/**
 * One slice of a fixture, taken round-robin so uneven case durations spread out.
 * `count` of 1 covers the whole fixture.
 */
export type ScenarioSlice = {
  /** 1-based slice number. */
  readonly index: number;
  readonly count: number;
};

/** A scenario bound to a device and a slice: the unit of work a runner takes. */
export type ScenarioRun = {
  readonly scenario: Scenario;
  readonly device: ScenarioDevice;
  /** Absent means every case in the fixture. */
  readonly slice?: ScenarioSlice;
};
