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
import { type ScenarioDevice } from "@root/src/domain/models/Scenario";
import { SCENARIO_CATALOG } from "@root/src/domain/scenarios/catalog";
import { planRuns } from "@root/src/domain/scenarios/planRuns";
import {
  ContainerScenarioRunner,
  type ScenarioRuntime,
} from "@root/src/infrastructure/scenarios/ContainerScenarioRunner";
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

function listScenarios(): void {
  const byGroup = new Map<string, string[]>();
  for (const s of SCENARIO_CATALOG) {
    const line = `${s.name.padEnd(34)} ${s.devices.join(", ")}`;
    byGroup.set(s.group, [...(byGroup.get(s.group) ?? []), line]);
  }
  for (const [group, lines] of byGroup) {
    console.log(`\n${group}`);
    for (const line of lines) console.log(`  ${line}`);
  }
  console.log(
    `\n${SCENARIO_CATALOG.length} scenarios. Select by group, by name, or "all".`,
  );
}

async function runTest(
  selectors: string[],
  options: {
    device?: ScenarioDevice;
    concurrency: number;
    list?: boolean;
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
  },
): Promise<number> {
  if (options.list) {
    listScenarios();
    return 0;
  }

  const runs = planRuns(SCENARIO_CATALOG, selectors, {
    device: options.device,
  });

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
  };

  console.log(
    `Running ${runs.length} scenario run(s) on ${options.device ?? "every supported device"}, ` +
      `${options.concurrency} at a time.`,
  );

  try {
    const report = await new RunScenariosUseCase(
      new ContainerScenarioRunner(runtime),
    ).execute(runs, {
      concurrency: options.concurrency,
      onOutcome: (outcome, done, total) =>
        console.log(
          `[${done}/${total}] ${outcome.run.scenario.name} @ ${outcome.run.device} — ` +
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
