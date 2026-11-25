import {
  type CalBranch,
  type CalMode,
} from "@root/src/domain/models/config/CalConfig";
import {
  BTC_LEGACY_COIN_APPS,
  type Scenario,
} from "@root/src/domain/models/Scenario";

/**
 * The CAL mode a run uses: the one asked for, or else the only one its other
 * options can verify under.
 *
 * Only `main` carries valid prod signatures throughout. On `next`, an entry
 * has none until the quorum signs it, or the stale one of its previous
 * payload, while its `test` signature is re-made on every push. Injected
 * ERC7730 descriptors are signed by the interceptor's signer. Both verify only
 * in test mode. `test` on `main` stays allowed: it is the parity run, the same
 * CAL content as a prod run but through the interceptor.
 *
 * @throws If `prod` is asked for with another branch than `main`, or with
 * ERC7730 files
 */
export function resolveCalMode({
  branch,
  mode,
  hasErc7730Files,
}: {
  readonly branch: CalBranch;
  readonly mode?: CalMode;
  readonly hasErc7730Files: boolean;
}): CalMode {
  if (mode === "prod" && branch !== "main") {
    throw new Error(
      `--cal-mode prod cannot run --cal-branch ${branch}: only main carries ` +
        `valid prod signatures. Drop --cal-mode, or pass --cal-mode test.`,
    );
  }
  if (mode === "prod" && hasErc7730Files) {
    throw new Error(
      `--cal-mode prod cannot run --erc7730-files: injected descriptors are ` +
        `signed with the test key. Drop --cal-mode, or pass --cal-mode test.`,
    );
  }
  return mode ?? (branch !== "main" || hasErc7730Files ? "test" : "prod");
}

const isBtcLegacy = (scenario: Scenario): boolean =>
  (BTC_LEGACY_COIN_APPS as readonly string[]).includes(scenario.coinApp);

const names = (scenarios: readonly Scenario[]): string =>
  [...new Set(scenarios.map((s) => s.name))].join(", ");

/**
 * Selected scenarios a branch other than `main` cannot change, so their
 * results are not read as `next` coverage.
 */
export function calBranchWarnings(
  branch: CalBranch,
  scenarios: readonly Scenario[],
): string[] {
  if (branch === "main") return [];

  const warnings: string[] = [];
  const tron = scenarios.filter((s) => s.coinApp === "Tron");
  if (tron.length > 0) {
    warnings.push(
      `--cal-branch ${branch} tests nothing beyond main for ${names(tron)}: ` +
        `the only CAL data Tron reads, its TRC10 descriptors, carry the same ` +
        `prod payload in both signature slots, checked by a key built into ` +
        `the app.`,
    );
  }
  const btcLegacy = scenarios.filter(isBtcLegacy);
  if (btcLegacy.length > 0) {
    warnings.push(
      `--cal-branch ${branch} does not apply to ${names(btcLegacy)}: ` +
        `legacy Bitcoin apps use no CAL.`,
    );
  }
  return warnings;
}
