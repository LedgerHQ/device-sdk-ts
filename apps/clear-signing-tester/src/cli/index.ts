#!/usr/bin/env node

import "@root/src/setup/installUndici";

import { ConsoleLogger } from "@ledgerhq/device-management-kit";
import { Command } from "commander";

import { RunScenariosUseCase } from "@root/src/application/scenarios/RunScenariosUseCase";
import {
  CLI_LOG_LEVELS,
  type CliLogLevel,
  parseLogLevel,
} from "@root/src/domain/models/config/LoggerConfig";
import {
  type Scenario,
  SCENARIO_DEVICES,
  type ScenarioDevice,
  type ScenarioRun,
} from "@root/src/domain/models/Scenario";
import { expandToCases } from "@root/src/domain/scenarios/expandToCases";
import { planRuns, selectScenarios } from "@root/src/domain/scenarios/planRuns";
import {
  ContainerScenarioRunner,
  type ScenarioRuntime,
} from "@root/src/infrastructure/scenarios/ContainerScenarioRunner";
import { countCases } from "@root/src/infrastructure/scenarios/countFixtureCases";
import {
  isEnabled,
  loadScenarioCatalog,
} from "@root/src/infrastructure/scenarios/loadScenarioCatalog";
import { ERC7730InterceptorService } from "@root/src/infrastructure/services/ERC7730InterceptorService";
import { LoggerPublisherService } from "@root/src/services/LoggerPublisherService";

import { reportScenarios } from "./reportScenarios";

/** Everything `test` accepts. Kept beside the flags so the two cannot drift. */
type TestOptions = {
  device?: ScenarioDevice;
  concurrency: number;
  /** Commander maps `--no-split` to `split: false`, so read the positive name. */
  split?: boolean;
  logLevel: CliLogLevel;
  fileLogLevel?: CliLogLevel;
  logDir?: string;
  screenshotFolderPath?: string;
  speculinhoUrl?: string;
  speculosHttpTimeout?: number;
  rpcUrl?: string;
  scanLimit?: number;
  samplesPerInstruction?: number;
  derivationPath: string;
  solanaDerivationPath: string;
  erc7730Files?: string[];
  osVersion?: string;
  appEthVersion?: string;
  appSolVersion?: string;
};

/** Exit codes are a byte, so a multiple of 256 would read as success. */
const asExitCode = (failures: number): number => Math.min(failures, 255);

const integer = (name: string) => (value: string) => {
  const n = Number.parseInt(value, 10);
  if (Number.isNaN(n) || n < 1) {
    throw new Error(
      `Invalid --${name} '${value}'. Expected a positive integer.`,
    );
  }
  return n;
};

const oneOf =
  <T extends string>(name: string, allowed: readonly T[]) =>
  (value: string): T => {
    if (!allowed.includes(value as T)) {
      throw new Error(
        `Invalid --${name} '${value}'. Must be one of: ${allowed.join(", ")}.`,
      );
    }
    return value as T;
  };

function listScenarios(): void {
  const all = loadScenarioCatalog();
  const enabled = all.filter(isEnabled);

  const byGroup = new Map<string, string[]>();
  for (const s of enabled) {
    const line = `${s.name.padEnd(34)} ${s.devices.join(", ")}`;
    byGroup.set(s.group, [...(byGroup.get(s.group) ?? []), line]);
  }
  for (const [group, lines] of byGroup) {
    console.log(`\n${group}`);
    for (const line of lines) console.log(`  ${line}`);
  }

  console.log(
    `\n${enabled.length} scenarios. Select by group, by name, or "all".`,
  );

  const disabled = all.filter((s) => !isEnabled(s));
  if (disabled.length > 0) {
    console.log(
      `\n${disabled.length} disabled, skipped by every selector ` +
        `(set "enabled": true in the file to run one):`,
    );
    for (const s of disabled) console.log(`  ${s.name}`);
  }
}

/**
 * A selector naming a disabled scenario would otherwise read as a typo, since
 * the scenario is absent from the catalog selection sees.
 *
 * @throws If a selector names a disabled scenario exactly
 */
function rejectDisabledSelectors(
  disabled: readonly Scenario[],
  selectors: readonly string[],
): void {
  const named = disabled.filter((s) => selectors.includes(s.name));
  if (named.length > 0) {
    throw new Error(
      `${named.map((s) => s.name).join(", ")} is disabled. ` +
        `Set "enabled": true in its scenario file to run it.`,
    );
  }
}

/** A device filter drops scenarios silently, which reads as "you were ignored". */
function reportUnsupported(
  selected: readonly Scenario[],
  device: ScenarioDevice | undefined,
): void {
  if (!device) return;
  const dropped = selected.filter((s) => !s.devices.includes(device));
  if (dropped.length > 0) {
    console.log(
      `Skipping ${dropped.length} scenario(s) that do not support ${device}: ` +
        dropped.map((s) => s.name).join(", "),
    );
  }
}

/** A version flag overrides the defaults, never a scenario's own pin. */
function reportOwnPins(
  selected: readonly Scenario[],
  options: TestOptions,
): void {
  const overriding =
    options.osVersion ?? options.appEthVersion ?? options.appSolVersion;
  if (!overriding) return;
  const pinned = selected.filter((s) => s.osVersion ?? s.appVersion);
  if (pinned.length > 0) {
    console.log(
      `Keeping ${pinned.length} scenario(s) on the version pinned in their own file: ` +
        pinned.map((s) => s.name).join(", "),
    );
  }
}

/**
 * The Solana RPC is wired into the container, so a program scenario cannot even
 * be resolved without it. Say so before acquiring an emulator.
 *
 * @throws If a selected program scenario has no RPC to pull from
 */
function requireRpc(
  runs: readonly ScenarioRun[],
  rpcUrl: string | undefined,
): void {
  const needRpc = runs.filter((r) => r.scenario.action === "solanaProgram");
  if (needRpc.length === 0 || rpcUrl) return;
  const names = [...new Set(needRpc.map((r) => r.scenario.name))];
  throw new Error(
    `${names.join(", ")} pull live transactions and need --rpc-url <solana rpc>. ` +
      `Pass it, or exclude the solana-programs group.`,
  );
}

function buildRuntime(
  options: TestOptions,
  calMode: ScenarioRuntime["calMode"],
): ScenarioRuntime {
  return {
    ethDerivationPath: options.derivationPath,
    solanaDerivationPath: options.solanaDerivationPath,
    logLevel: options.logLevel,
    fileLogLevel: options.fileLogLevel,
    logDir: options.logDir,
    screenshotPath: options.screenshotFolderPath,
    speculinhoUrl: options.speculinhoUrl,
    speculosHttpTimeoutMs: options.speculosHttpTimeout,
    solanaRpcUrl: options.rpcUrl,
    scanLimit: options.scanLimit,
    samplesPerInstruction: options.samplesPerInstruction,
    originToken: process.env["GATING_TOKEN"] || "test-origin-token",
    calMode,
  };
}

/** The cases to run, after selection, the device filter and case splitting. */
function planCases(
  selectors: string[],
  options: TestOptions,
): { runs: readonly ScenarioRun[]; scenarioRuns: readonly ScenarioRun[] } {
  const all = loadScenarioCatalog();
  rejectDisabledSelectors(
    all.filter((s) => !isEnabled(s)),
    selectors,
  );

  const catalog = all.filter(isEnabled);
  const selected = selectScenarios(catalog, selectors);
  reportUnsupported(selected, options.device);
  reportOwnPins(selected, options);

  const scenarioRuns = planRuns(catalog, selectors, {
    device: options.device,
  });
  requireRpc(scenarioRuns, options.rpcUrl);

  // A case is the unit of work: split each fixture so its cases can run on
  // separate emulators, leaving order-dependent scenarios whole.
  const runs =
    options.split === false
      ? scenarioRuns
      : expandToCases(
          scenarioRuns,
          countCases(scenarioRuns.map((r) => r.scenario)),
        );

  return { runs, scenarioRuns };
}

async function runTest(
  selectors: string[],
  options: TestOptions,
): Promise<number> {
  const { runs, scenarioRuns } = planCases(selectors, options);

  if (runs.length === 0) {
    console.log(
      `Nothing to run: no selected scenario supports ${options.device}.`,
    );
    return 0;
  }

  // Injected descriptors are served over HTTP for the whole process, so the
  // interceptor is set up once rather than per scenario.
  const files = options.erc7730Files ?? [];
  const cliLogger = new LoggerPublisherService(
    ((level) => (level === null ? [] : [new ConsoleLogger(level)]))(
      parseLogLevel(options.logLevel),
    ),
    "cli",
  );
  const interceptor =
    files.length > 0 ? new ERC7730InterceptorService(cliLogger) : undefined;
  if (interceptor) await interceptor.setupFromFiles(files);

  const runtime = buildRuntime(options, interceptor ? "test" : "prod");

  console.log(
    `Running ${runs.length} case(s) from ${scenarioRuns.length} scenario run(s) on ` +
      `${options.device ?? "every supported device"}, ${options.concurrency} at a time.`,
  );

  try {
    const report = await new RunScenariosUseCase(
      new ContainerScenarioRunner(runtime),
    ).execute(runs, {
      concurrency: options.concurrency,
      onOutcome: (outcome, done, total) =>
        console.log(
          `[${done}/${total}] ${outcome.run.scenario.name}` +
            `${outcome.run.slice ? ` case ${outcome.run.slice.index}/${outcome.run.slice.count}` : ""}` +
            ` @ ${outcome.run.device} — ` +
            (outcome.errorMessage
              ? `did not run: ${outcome.errorMessage}`
              : `${outcome.failures === 0 ? "passed" : `${outcome.failures} failing`}`),
        ),
    });
    reportScenarios(report);
    return asExitCode(report.failures);
  } finally {
    interceptor?.stop();
  }
}

function buildProgram(): Command {
  const program = new Command();

  program
    .name("cs-tester")
    .description("Run clear-signing scenarios against Speculinho emulators");

  program
    .command("list")
    .description("List every scenario and exit")
    .action(listScenarios);

  program
    .command("test", { isDefault: true })
    .description("Run the selected scenarios")
    .argument(
      "[scenarios...]",
      'Groups, scenario names, or "all" (the default)',
    )
    .option(
      "--device <device>",
      `Run only scenarios supporting this device: ${SCENARIO_DEVICES.join(", ")}`,
      oneOf("device", SCENARIO_DEVICES),
    )
    .option(
      "--concurrency <n>",
      "How many cases may hold an emulator at once (default: 4)",
      integer("concurrency"),
      4,
    )
    .option(
      "--no-split",
      "Run each scenario's whole fixture on one emulator instead of a case per emulator",
    )
    .option(
      "--log-level <level>",
      `Console log level: ${CLI_LOG_LEVELS.join(", ")} (default: info)`,
      oneOf("log-level", CLI_LOG_LEVELS),
      "info" as CliLogLevel,
    )
    .option(
      "--file-log-level <level>",
      `File log level, defaults to --log-level: ${CLI_LOG_LEVELS.join(", ")}`,
      oneOf("file-log-level", CLI_LOG_LEVELS),
    )
    .option(
      "--log-dir <path>",
      "Write one log file per case into this directory",
    )
    .option(
      "--screenshot-folder-path <path>",
      "Save screenshots taken during signing",
    )
    .option(
      "--speculinho-url <url>",
      "Speculinho operator URL (default: https://speculinho.ledgerlabs.net, or SPECULINHO_URL)",
    )
    .option(
      "--speculos-http-timeout <ms>",
      "HTTP timeout for Speculos pod requests (0 = none, the default)",
      integer("speculos-http-timeout"),
    )
    .option(
      "--rpc-url <url>",
      "Solana RPC endpoint, required by the solana-programs group",
    )
    .option(
      "--scan-limit <n>",
      "Recent signatures to scan for clear-signable transactions",
      integer("scan-limit"),
    )
    .option(
      "--samples-per-instruction <n>",
      "Transactions to test per instruction type",
      integer("samples-per-instruction"),
    )
    .option(
      "--derivation-path <path>",
      "Ethereum derivation path",
      "44'/60'/0'/0/0",
    )
    .option(
      "--solana-derivation-path <path>",
      "Solana derivation path",
      "44'/501'/0'",
    )
    .option(
      "--os-version <version>",
      "Override the OS version from default_versions.json, for a one-off run",
    )
    .option(
      "--app-eth-version <version>",
      "Override the default Ethereum app version",
    )
    .option(
      "--app-sol-version <version>",
      "Override the default Solana app version",
    )
    .option(
      "--erc7730-files <files...>",
      "ERC7730 descriptors to inject, which also switches CAL to test mode",
    )
    .action(async (scenarios: string[], options: TestOptions) => {
      process.exitCode = await runTest(scenarios, options);
    });

  return program;
}

async function main(): Promise<void> {
  try {
    await buildProgram().parseAsync(process.argv);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

void main();
