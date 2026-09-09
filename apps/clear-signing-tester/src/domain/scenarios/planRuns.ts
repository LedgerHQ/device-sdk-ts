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
export function planRuns(
  catalog: readonly Scenario[],
  selectors: readonly string[],
  options: PlanOptions = {},
): readonly ScenarioRun[] {
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
          `Use --list to see every scenario.`,
      );
    }
    for (const scenario of matches) selected.set(scenario.name, scenario);
  }

  const runs: ScenarioRun[] = [];
  for (const scenario of selected.values()) {
    const devices = options.device
      ? scenario.devices.filter((d) => d === options.device)
      : scenario.devices;
    for (const device of devices) runs.push({ scenario, device });
  }
  return runs;
}
