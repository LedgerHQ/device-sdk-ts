#!/usr/bin/env node

import { type LoggerPublisherService } from "@ledgerhq/device-management-kit";
import { Command } from "commander";
import { type Container } from "inversify";

import { type TestBatchTransactionFromFileUseCase } from "@root/src/application/usecases/TestBatchTransactionFromFileUseCase";
import { type TestSolanaTransactionUseCase } from "@root/src/application/usecases/TestSolanaTransactionUseCase";
import { type ClearSigningTesterConfig } from "@root/src/di/modules/configModuleFactory";
import { makeSolanaContainer } from "@root/src/di/solanaContainer";
import { TYPES } from "@root/src/di/types";
import {
  CLI_LOG_LEVELS,
  type CliLogLevel,
} from "@root/src/domain/models/config/LoggerConfig";
import { type SpeculosConfig } from "@root/src/domain/models/config/SpeculosConfig";
import { SignableInputKind } from "@root/src/domain/models/SignableInputKind";
import { type ServiceController } from "@root/src/domain/services/ServiceController";

export type SolanaCliConfig = {
  // config.speculos
  speculosUrl: string;
  speculosPort: number;
  speculosVncPort?: number;
  dockerImageTag?: string;
  device: SpeculosConfig["device"];
  appSolVersion?: SpeculosConfig["version"];
  osVersion?: SpeculosConfig["os"];
  screenshotFolderPath?: string;
  customApp?: string;
  forcePull?: boolean;

  // config.logger
  logLevel: CliLogLevel;
  logFile?: string;
  fileLogLevel?: CliLogLevel;

  // extras
  derivationPath: string;
  skipCraft?: boolean;

  // Start Speculos only (skip DMK initialization)
  onlySpeculos?: boolean;
};

/**
 * CLI for Solana transaction testing.
 * Composition root for the Solana clear-signing tester.
 */
export class SolanaTransactionTesterCli {
  private container: Container;
  private controller: ServiceController;
  private logger: LoggerPublisherService;
  private config: SolanaCliConfig;

  constructor(config: SolanaCliConfig) {
    this.config = config;

    const randomPort = Math.floor(Math.random() * 10000) + 10000;
    const randomVncPort = Math.floor(Math.random() * 10000) + 20000;

    const diConfig: ClearSigningTesterConfig = {
      speculos: {
        url: config.speculosUrl || "http://localhost",
        port: config.speculosPort || randomPort,
        vncPort: config.speculosVncPort || randomVncPort,
        dockerImageTag: config.dockerImageTag || "latest",
        device: config.device,
        appName: "Solana",
        os: config.osVersion,
        version: config.appSolVersion,
        screenshotPath: config.screenshotFolderPath,
        customAppPath: config.customApp,
        forcePull: config.forcePull,
      },
      signer: {
        originToken: process.env["GATING_TOKEN"] || "test-origin-token",
        gated: true,
      },
      cal: {
        url: "https://crypto-assets-service.api.ledger.com/v1",
        mode: "prod",
        branch: "main",
      },
      etherscan: {
        apiKey: "",
      },
      apps: {
        path: process.env["COIN_APPS_PATH"] || "",
      },
      onlySpeculos: config.onlySpeculos,
    };

    this.container = makeSolanaContainer({
      config: diConfig,
      logger: {
        cli: {
          level: config.logLevel,
        },
        file: config.logFile
          ? {
              level: config.fileLogLevel || config.logLevel,
              filePath: config.logFile,
            }
          : undefined,
      },
    });

    const loggerFactory = this.container.get<
      (tag: string) => LoggerPublisherService
    >(TYPES.LoggerPublisherServiceFactory);
    this.logger = loggerFactory("cli");

    this.controller = this.container.get<ServiceController>(
      TYPES.MainServiceController,
    );
  }

  async initialize(): Promise<void> {
    await this.controller.start();
  }

  async cleanup(): Promise<void> {
    await this.controller.stop();
  }

  static createProgram(): Command {
    const program = new Command();
    let cli: SolanaTransactionTesterCli | null = null;
    let exitCode = 0;

    program
      .name("solana-clear-signing-tester")
      .description("Solana Transaction Tester CLI")
      .version("1.0.0");

    program
      .option(
        "--derivation-path <path>",
        "Derivation path (default: \"44'/501'/0'\")",
        "44'/501'/0'",
      )
      .option(
        "--speculos-url <url>",
        "Speculos server URL (default: http://localhost)",
        "http://localhost",
      )
      .option(
        "--speculos-port <port>",
        "Speculos server port (random port if not provided)",
        (value: string) => {
          const port = parseInt(value);
          if (isNaN(port) || port < 1 || port > 65535) {
            throw new Error("Invalid port number");
          }
          return port;
        },
      )
      .option(
        "--speculos-vnc-port <port>",
        "Speculos VNC port (random port if not provided)",
        (value: string) => {
          const port = parseInt(value);
          if (isNaN(port) || port < 1 || port > 65535) {
            throw new Error("Invalid port number");
          }
          return port;
        },
      )
      .option(
        "--device <device>",
        "Device type (stax, nanox, nanos, nanos+, flex, apex, default: stax)",
        (value: string) => {
          const supportedDevices = [
            "stax",
            "nanox",
            "nanos",
            "nanos+",
            "flex",
            "apex",
          ];
          if (!supportedDevices.includes(value)) {
            throw new Error(
              `Invalid device type '${value}'. Must be either ${supportedDevices.join(
                ", ",
              )}.`,
            );
          }
          return value;
        },
        "stax",
      )
      .option(
        "--app-sol-version <version>",
        "Solana app version (e.g., 1.5.0). If not specified, uses latest version for the device.",
      )
      .option(
        "--os-version <version>",
        "Device OS version (e.g., 1.8.1). If not specified, uses latest OS version for the device.",
      )
      .option(
        "--skip-craft",
        "Skip payer replacement (transaction crafting) for all transactions",
        false,
      )
      .option(
        "--docker-image-tag <tag>",
        "Docker image tag for Speculos (default: latest)",
        "latest",
      )
      .option(
        "--screenshot-folder-path <path>",
        "Save screenshots to a folder during transaction signing",
      )
      .option(
        "--custom-app <path>",
        "Custom app file path. Relative paths resolve to COIN_APPS_PATH, absolute paths are mounted automatically.",
      )
      .option(
        "--force-pull",
        "Force pulling the Docker image even if it already exists locally",
        false,
      )
      .option(
        "--log-level <level>",
        `Console log level: ${CLI_LOG_LEVELS.join(", ")} (default: info)`,
        (value: string) => {
          if (!CLI_LOG_LEVELS.includes(value as CliLogLevel)) {
            throw new Error(
              `Invalid log level '${value}'. Must be one of: ${CLI_LOG_LEVELS.join(", ")}`,
            );
          }
          return value as CliLogLevel;
        },
        "info" as CliLogLevel,
      )
      .option("--log-file <path>", "Log output to a file")
      .option(
        "--file-log-level <level>",
        `File log level: ${CLI_LOG_LEVELS.join(", ")} (requires --log-file)`,
        (value: string) => {
          if (!CLI_LOG_LEVELS.includes(value as CliLogLevel)) {
            throw new Error(
              `Invalid log level '${value}'. Must be one of: ${CLI_LOG_LEVELS.join(", ")}`,
            );
          }
          return value as CliLogLevel;
        },
      );

    const handleShutdown = async (signal: string) => {
      cli?.logger.info(`Received ${signal}, cleaning up...`);
      await cli?.cleanup();
      process.exit(0);
    };

    process.once("SIGINT", () => handleShutdown("SIGINT"));
    process.once("SIGTERM", () => handleShutdown("SIGTERM"));

    program.hook("preAction", async (_, command) => {
      const config = command.parent!.opts() as SolanaCliConfig;
      config.onlySpeculos = command.name() === "start-speculos";
      cli = new SolanaTransactionTesterCli(config);
      await cli.initialize();
    });

    program.hook("postAction", async () => {
      await cli?.cleanup();
      if (exitCode !== 0) {
        process.exit(exitCode);
      }
    });

    program
      .command("raw-transaction <transaction>")
      .description("Test a single raw Solana transaction (base64-encoded)")
      .action(async (transaction) => {
        exitCode = await cli!.handleRawTransaction(transaction);
      });

    program
      .command("raw-file <file>")
      .description("Test multiple raw Solana transactions from a JSON file")
      .action(async (file) => {
        exitCode = await cli!.handleRawFile(file);
      });

    program
      .command("start-speculos")
      .description(
        "Start Speculos emulator without running any signing tests. Press Ctrl+C to stop.",
      )
      .action(async () => {
        await cli!.handleStartSpeculos();
      });

    return program;
  }

  async handleRawTransaction(transaction: string): Promise<number> {
    const testUseCase = this.container.get<TestSolanaTransactionUseCase>(
      TYPES.TestSolanaTransactionUseCase,
    );

    const result = await testUseCase.execute(
      {
        kind: SignableInputKind.Transaction,
        rawTx: transaction,
        description: "Single Solana transaction test",
        skipCraft: this.config.skipCraft,
      },
      { derivationPath: this.config.derivationPath },
    );

    console.log(`\n${result.title}`);
    console.table([result.data]);

    return result.exitCode;
  }

  async handleRawFile(file: string): Promise<number> {
    const batchUseCase =
      this.container.get<TestBatchTransactionFromFileUseCase>(
        TYPES.TestBatchSolanaTransactionFromFileUseCase,
      );

    const result = await batchUseCase.execute(file, {
      defaultDerivationPath: this.config.derivationPath,
    });

    console.log(`\n${result.title}`);
    console.table(result.resultsTable);
    console.log(`\n${result.summaryTitle}`);
    console.table(result.summaryTable);

    return result.exitCode;
  }

  async handleStartSpeculos(): Promise<void> {
    this.logger.info("Speculos is running. Press Ctrl+C to stop.");
    await new Promise<void>(() => {});
  }
}

async function main() {
  try {
    const program = SolanaTransactionTesterCli.createProgram();
    await program.parseAsync(process.argv);
  } catch (error) {
    console.error("Unhandled error:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Unhandled error:", error);
    process.exit(1);
  });
}

export { main as runSolanaCli };
