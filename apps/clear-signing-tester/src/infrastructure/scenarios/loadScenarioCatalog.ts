import { readdirSync, readFileSync } from "fs";
import { join } from "path";

import {
  type Scenario,
  type ScenarioAction,
  type ScenarioCoinApp,
  type ScenarioDevice,
} from "@root/src/domain/models/Scenario";

/** Directory holding the scenario files, relative to the app root. */
export const SCENARIOS_DIR = "ressources";

const ACTIONS: readonly ScenarioAction[] = [
  "signTransaction",
  "signTypedData",
  "registerContact",
  "solanaProgram",
];
const DEVICES: readonly ScenarioDevice[] = [
  "stax",
  "nanox",
  "nanos",
  "nanos+",
  "flex",
  "apex",
];
const COIN_APPS: readonly ScenarioCoinApp[] = ["Ethereum", "Solana"];
const MODES = ["parallel", "sequential"] as const;

type Json = Record<string, unknown>;

/**
 * A scenario file describes how to run itself, so adding a scenario is a new
 * file rather than a code change. Everything but the cases is metadata:
 *
 * ```json
 * {
 *   "group": "contacts",
 *   "name": "sign",
 *   "action": "signTransaction",
 *   "devices": ["flex"],
 *   "coinApp": "Ethereum",
 *   "osVersion": "1.7.0-rc2",
 *   "appVersion": "1.23.0-dev",
 *   "mode": "parallel",
 *   "cases": [{ "rawTx": "0x02f8…", "expectedTexts": ["Bob"] }]
 * }
 * ```
 *
 * Files that are not scenarios live alongside them untouched — an address book,
 * or a fixture kept for manual runs — because a file counts as a scenario only
 * once it declares an `action`.
 */
export function loadScenarioCatalog(dir: string = SCENARIOS_DIR): Scenario[] {
  const byName = new Map<string, { scenario: Scenario; path: string }>();

  for (const path of scenarioFiles(dir)) {
    const parsed = parseFile(path);
    if (!isScenarioFile(parsed)) continue;

    const scenario = toScenario(parsed, path);
    const clash = byName.get(scenario.name);
    if (clash) {
      throw new Error(
        `Two scenario files both declare "${scenario.name}": ` +
          `${clash.path} and ${path}.`,
      );
    }
    byName.set(scenario.name, { scenario, path });
  }

  return [...byName.values()]
    .map(({ scenario }) => scenario)
    .sort(
      (a, b) => a.group.localeCompare(b.group) || a.name.localeCompare(b.name),
    );
}

function scenarioFiles(dir: string): string[] {
  return readdirSync(dir, { recursive: true, encoding: "utf-8" })
    .filter((entry) => entry.endsWith(".json"))
    .map((entry) => join(dir, entry))
    .sort();
}

function parseFile(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, "utf-8"));
  } catch (error) {
    throw new Error(
      `${path} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

/** An `action` is what marks a file as a scenario rather than plain data. */
function isScenarioFile(parsed: unknown): parsed is Json {
  return (
    typeof parsed === "object" &&
    parsed !== null &&
    !Array.isArray(parsed) &&
    typeof (parsed as Json)["action"] === "string"
  );
}

function toScenario(raw: Json, path: string): Scenario {
  // Annotated, not inferred: TypeScript only narrows past a never-returning
  // call when the variable carries the type explicitly.
  const fail: (message: string) => never = (message) => {
    throw new Error(`${path}: ${message}`);
  };

  const group = raw["group"];
  const name = raw["name"];
  const action = raw["action"];
  const coinApp = raw["coinApp"];
  const devices = raw["devices"];
  const mode = raw["mode"] ?? "parallel";

  if (typeof group !== "string" || group === "") fail(`needs a "group".`);
  if (typeof name !== "string" || name === "") fail(`needs a "name".`);
  if (!ACTIONS.includes(action as ScenarioAction)) {
    fail(
      `has an unknown "action" ${JSON.stringify(action)}; expected one of ${ACTIONS.join(", ")}.`,
    );
  }
  if (!COIN_APPS.includes(coinApp as ScenarioCoinApp)) {
    fail(`has an unknown "coinApp" ${JSON.stringify(coinApp)}.`);
  }
  if (!Array.isArray(devices) || devices.length === 0) {
    fail(`needs a non-empty "devices" list.`);
  }
  const unknownDevice = (devices as unknown[]).find(
    (device) => !DEVICES.includes(device as ScenarioDevice),
  );
  if (unknownDevice !== undefined) {
    fail(`lists an unknown device ${JSON.stringify(unknownDevice)}.`);
  }
  if (!MODES.includes(mode as (typeof MODES)[number])) {
    fail(
      `has an unknown "mode" ${JSON.stringify(mode)}; expected parallel or sequential.`,
    );
  }

  const scenarioAction = action as ScenarioAction;
  if (scenarioAction === "solanaProgram") {
    if (raw["cases"] !== undefined) {
      fail(
        `is a solanaProgram scenario, whose transactions come from the RPC, so it must not carry "cases".`,
      );
    }
  } else if (!Array.isArray(raw["cases"]) || raw["cases"].length === 0) {
    fail(`needs a non-empty "cases" list.`);
  }

  return {
    name: `${group}:${name}`,
    group,
    devices: devices as ScenarioDevice[],
    coinApp: coinApp as ScenarioCoinApp,
    action: scenarioAction,
    // The scenario file holds its own cases, so it is its own fixture.
    ...(scenarioAction === "solanaProgram"
      ? { program: name }
      : { fixture: path }),
    ...(raw["options"]
      ? { options: raw["options"] as Scenario["options"] }
      : {}),
    ...(typeof raw["osVersion"] === "string"
      ? { osVersion: raw["osVersion"] }
      : {}),
    ...(typeof raw["appVersion"] === "string"
      ? { appVersion: raw["appVersion"] }
      : {}),
    ...(mode === "sequential" ? { sequential: true } : {}),
  };
}

/** Groups present in the catalog, in the order `--list` shows them. */
export function scenarioGroups(catalog: readonly Scenario[]): string[] {
  return [...new Set(catalog.map((scenario) => scenario.group))];
}
