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
  type ScenarioDevice,
} from "@root/src/domain/models/Scenario";
import { expandToCases } from "@root/src/domain/scenarios/expandToCases";
import { planRuns, selectScenarios } from "@root/src/domain/scenarios/planRuns";
import {
  ContainerScenarioRunner,
  type ScenarioRuntime,
} from "@root/src/infrastructure/scenarios/ContainerScenarioRunner";
import { countCases } from "@root/src/infrastructure/scenarios/countFixtureCases";
import { loadScenarioCatalog } from "@root/src/infrastructure/scenarios/loadScenarioCatalog";
import { ERC7730InterceptorService } from "@root/src/infrastructure/services/ERC7730InterceptorService";
import { LoggerPublisherService } from "@root/src/services/LoggerPublisherService";

import { reportScenarios } from "./reportScenarios";

const DEVICES: ScenarioDevice[] = [
  "stax",
  "nanox",
  "nanos",
  "nanos+",
  "flex",
  "apex",
];

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

function listScenarios(catalog: readonly Scenario[]): void {
  const byGroup = new Map<string, string[]>();
  for (const s of catalog) {
    const line = `${s.name.padEnd(34)} ${s.devices.join(", ")}`;
    byGroup.set(s.group, [...(byGroup.get(s.group) ?? []), line]);
  }
  for (const [group, lines] of byGroup) {
    console.log(`\n${group}`);
    for (const line of lines) console.log(`  ${line}`);
  }
  console.log(
    `\n${catalog.length} scenarios. Select by group, by name, or "all".`,
  );
}

async function runTest(
  selectors: string[],
  options: {
    device?: ScenarioDevice;
    concurrency: number;
    list?: boolean;
    /** Commander maps --no-split to split: false, so read the positive name. */
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
  },
): Promise<number> {
  const catalog = loadScenarioCatalog();

  if (options.list) {
    listScenarios(catalog);
    return 0;
  }

  const selected = selectScenarios(catalog, selectors);
  const scenarioRuns = planRuns(catalog, selectors, {
    device: options.device,
  });

  // A device filter drops scenarios silently, which reads as "my selection was
  // ignored". Name them instead.
  if (options.device) {
    const dropped = selected.filter(
      (s) => !s.devices.includes(options.device!),
    );
    if (dropped.length > 0) {
      console.log(
        `Skipping ${dropped.length} scenario(s) that do not support ${options.device}: ` +
          dropped.map((s) => s.name).join(", "),
      );
    }
  }

  // The Solana RPC is wired into the container, so a program scenario cannot
  // even be resolved without it. Say so before acquiring an emulator.
  const needRpc = scenarioRuns.filter(
    (r) => r.scenario.action === "solanaProgram",
  );
  if (needRpc.length > 0 && !options.rpcUrl) {
    const names = [...new Set(needRpc.map((r) => r.scenario.name))];
    throw new Error(
      `${names.join(", ")} pull live transactions and need --rpc-url <solana rpc>. ` +
        `Pass it, or exclude the solana-programs group.`,
    );
  }

  // A case is the unit of work: split each fixture so its cases can run on
  // separate emulators, leaving order-dependent scenarios whole.
  const runs =
    options.split === false
      ? scenarioRuns
      : expandToCases(
          scenarioRuns,
          countCases(scenarioRuns.map((r) => r.scenario)),
        );

  if (runs.length === 0) {
    console.log(
      `Nothing to run: no selected scenario supports ${options.device}.`,
    );
    return 0;
  }

  // Injected descriptors are served over HTTP for the whole process, so the
  // interceptor is set up once rather than per scenario.
  const useInjectedDescriptors = (options.erc7730Files ?? []).length > 0;
  const consoleLevel = parseLogLevel(options.logLevel);
  const cliLogger = new LoggerPublisherService(
    consoleLevel === null ? [] : [new ConsoleLogger(consoleLevel)],
    "cli",
  );
  const interceptor = useInjectedDescriptors
    ? new ERC7730InterceptorService(cliLogger)
    : undefined;
  if (interceptor && options.erc7730Files) {
    await interceptor.setupFromFiles(options.erc7730Files);
  }

  const runtime: ScenarioRuntime = {
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
    calMode: useInjectedDescriptors ? "test" : "prod",
    osVersion: options.osVersion,
    ethAppVersion: options.appEthVersion,
    solanaAppVersion: options.appSolVersion,
  };

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
    .command("test", { isDefault: true })
    .argument(
      "[scenarios...]",
      'Groups, scenario names, or "all" (the default)',
    )
    .option(
      "--device <device>",
      `Run only scenarios supporting this device: ${DEVICES.join(", ")}`,
      oneOf("device", DEVICES),
    )
    .option(
      "--concurrency <n>",
      "How many scenarios may hold an emulator at once (default: 4)",
      integer("concurrency"),
      4,
    )
    .option("--list", "List every scenario and exit")
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
      "Write one log file per scenario into this directory",
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
      "Override the OS version pinned in default_versions.json, for a one-off run",
    )
    .option(
      "--app-eth-version <version>",
      "Override the pinned Ethereum app version",
    )
    .option(
      "--app-sol-version <version>",
      "Override the pinned Solana app version",
    )
    .option(
      "--erc7730-files <files...>",
      "ERC7730 descriptors to inject, which also switches CAL to test mode",
    )
    .action(async (scenarios: string[], options) => {
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
