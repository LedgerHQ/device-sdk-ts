import {
  type Scenario,
  type ScenarioDevice,
  type ScenarioRun,
} from "@root/src/domain/models/Scenario";

/** Selector meaning "every scenario in the catalog". */
export const ALL_SELECTOR = "all";

export type PlanOptions = {
  /** Restrict to one device, as a CI job does. Omitted runs every device a scenario supports. */
  readonly device?: ScenarioDevice;
};

/**
 * Turn selectors into the concrete runs to execute.
 *
 * A selector is `all`, a group name, or a scenario name, so a caller can ask
 * for a family or a single case with the same syntax. Runs are the cross
 * product of the selected scenarios and their devices, which is what makes them
 * independently schedulable across emulators.
 *
 * @throws If a selector matches nothing, listing what is available
 */
/**
 * The scenarios a set of selectors names, deduped and in catalog order.
 *
 * Separate from {@link planRuns} so a caller can tell the difference between
 * "you selected nothing" and "nothing you selected runs on that device".
 *
 * @throws If a selector matches nothing, listing what is available
 */
export function selectScenarios(
  catalog: readonly Scenario[],
  selectors: readonly string[],
): readonly Scenario[] {
  const wanted = selectors.length === 0 ? [ALL_SELECTOR] : selectors;

  const selected = new Map<string, Scenario>();
  for (const selector of wanted) {
    const matches =
      selector === ALL_SELECTOR
        ? catalog
        : catalog.filter((s) => s.group === selector || s.name === selector);

    if (matches.length === 0) {
      const groups = [...new Set(catalog.map((s) => s.group))].sort();
      throw new Error(
        `Unknown scenario or group "${selector}". Groups: ${groups.join(", ")}. ` +
          `Run "cs-tester list" to see every scenario.`,
      );
    }
    for (const scenario of matches) selected.set(scenario.name, scenario);
  }
  return [...selected.values()];
}

export function planRuns(
  catalog: readonly Scenario[],
  selectors: readonly string[],
  options: PlanOptions = {},
): readonly ScenarioRun[] {
  const runs: ScenarioRun[] = [];
  for (const scenario of selectScenarios(catalog, selectors)) {
    const devices = options.device
      ? scenario.devices.filter((d) => d === options.device)
      : scenario.devices;
    for (const device of devices) runs.push({ scenario, device });
  }
  return runs;
}
