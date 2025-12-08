#!/usr/bin/env node

import { Command } from "commander";
import { type Container } from "inversify";

import { type TestBatchContractFromFileUseCase } from "@root/src/application/usecases/TestBatchContractFromFileUseCase";
import { type TestBatchTransactionFromFileUseCase } from "@root/src/application/usecases/TestBatchTransactionFromFileUseCase";
import { type TestBatchTypedDataFromFileUseCase } from "@root/src/application/usecases/TestBatchTypedDataFromFileUseCase";
import { type TestContractUseCase } from "@root/src/application/usecases/TestContractUseCase";
import { type TestTransactionUseCase } from "@root/src/application/usecases/TestTransactionUseCase";
import { type TestTypedDataUseCase } from "@root/src/application/usecases/TestTypedDataUseCase";
import { makeContainer } from "@root/src/di/container";
import { type ClearSigningTesterConfig } from "@root/src/di/modules/configModuleFactory";
import { TYPES } from "@root/src/di/types";
import {
  CLI_LOG_LEVELS,
  type CliLogLevel,
} from "@root/src/domain/models/config/LoggerConfig";
import { type SpeculosConfig } from "@root/src/domain/models/config/SpeculosConfig";
import { type ServiceController } from "@root/src/domain/services/ServiceController";

export type CliConfig = {
  // config.speculos
  speculosUrl: string;
  speculosPort: number;
  dockerImageTag?: string;
  device: SpeculosConfig["device"];
  appEthVersion?: SpeculosConfig["version"];
  osVersion?: SpeculosConfig["os"];
  plugin?: string;
  pluginVersion?: string;

  // config.signer
  skipCal?: boolean;

  // config.logger
  logLevel: CliLogLevel;
  logFile?: string;
  fileLogLevel?: CliLogLevel;

  // extras (not in config section but used by CLI)
  derivationPath: string;
};

/**
 * CLI for EthereumTransactionTester
 *
 * Provides a command-line interface for testing Ethereum transactions
 * using the clean architecture EthereumTransactionTester with dependency injection.
 * This is the composition root of the application.
 */
export class EthereumTransactionTesterCli {
  private container: Container;
  private controller: ServiceController;
  private config: CliConfig;

  constructor(config: CliConfig) {
    this.config = config;

    const randomPort = Math.floor(Math.random() * 10000) + 10000;

    // Create DI container configuration
    const diConfig: ClearSigningTesterConfig = {
      speculos: {
        url: config.speculosUrl || `http://localhost`,
        port: config.speculosPort || randomPort,
        dockerImageTag: config.dockerImageTag || "latest",
        device: config.device,
        os: config.osVersion,
        version: config.appEthVersion,
        plugin: config.plugin,
        pluginVersion: config.pluginVersion,
      },
      signer: {
        originToken: process.env["GATING_TOKEN"] || "test-origin-token",
        gated: true,
      },
      etherscan: {
        apiKey: process.env["ETHERSCAN_API_KEY"] || "default-key",
      },
      apps: {
        path: process.env["COIN_APPS_PATH"] || "",
      },
    };

    // Create DI container and resolve tester
    this.container = makeContainer({
      config: diConfig,
      logger: {
        cli: {
          level: config.logLevel,
        },
        file: config.logFile
          ? {
              // default to cli log level if file log level is not specified,
              level: config.fileLogLevel || config.logLevel,
              filePath: config.logFile,
            }
          : undefined,
      },
    });

    this.controller = this.container.get<ServiceController>(
      TYPES.MainServiceController,
    );
  }

  /**
   * Initialize the CLI by setting up the controller
   */
  async initialize(): Promise<void> {
    await this.controller.start();
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    await this.controller.stop();
  }

  /**
   * Create Commander.js program with all CLI commands
   */
  static createProgram(): Command {
    const program = new Command();
    let cli: EthereumTransactionTesterCli | null = null;
    let exitCode = 0;

    program
      .name("ethereum-clear-signing-tester")
      .description(
        "Ethereum Transaction Tester CLI - Clean Architecture Edition",
      )
      .version("1.0.0");

    // Add global options
    program
      .option(
        "--derivation-path <path>",
        "Derivation path (default: \"44'/60'/0'/0/0\")",
        "44'/60'/0'/0/0",
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
        "--app-eth-version <version>",
        "Ethereum app version (e.g., 1.19.1). If not specified, uses latest version for the device.",
      )
      .option(
        "--os-version <version>",
        "Device OS version (e.g., 1.8.1). If not specified, uses latest OS version for the device.",
      )
      .option(
        "--plugin <plugin>",
        "Plugin to use. If not specified, uses no plugin.",
      )
      .option(
        "--plugin-version <version>",
        "Plugin version to use. If not specified, uses latest version.",
      )
      .option(
        "--docker-image-tag <tag>",
        "Docker image tag for Speculos (default: latest)",
        "latest",
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

    // Set up signal handlers that work with the CLI instance
    const handleShutdown = async (signal: string) => {
      console.error(`Received ${signal}, cleaning up...`);
      await cli?.cleanup();
      process.exit(0);
    };

    process.on("SIGINT", () => handleShutdown("SIGINT"));
    process.on("SIGTERM", () => handleShutdown("SIGTERM"));

    program.hook("preAction", async (_, command) => {
      const config = command.parent!.opts() as CliConfig;
      cli = new EthereumTransactionTesterCli(config);
      await cli.initialize();
    });

    program.hook("postAction", async () => {
      await cli?.cleanup();
      if (exitCode !== 0) {
        process.exit(exitCode);
      }
    });

    // Raw transaction command
    program
      .command("raw-transaction <transaction>")
      .description("Test a single raw transaction")
      .action(async (transaction) => {
        exitCode = await cli!.handleRawTransaction(transaction);
      });

    // Raw file command
    program
      .command("raw-file <file>")
      .description("Test multiple raw transactions from a JSON file")
      .action(async (file) => {
        exitCode = await cli!.handleRawFile(file);
      });

    // Typed data command
    program
      .command("typed-data <data>")
      .description("Test a single typed data object (JSON string)")
      .action(async (data) => {
        exitCode = await cli!.handleTypedData(data);
      });

    // Typed data file command
    program
      .command("typed-data-file <file>")
      .description("Test multiple typed data objects from a JSON file")
      .action(async (file) => {
        exitCode = await cli!.handleTypedDataFile(file);
      });

    program
      .command("contract <address>")
      .description("Test a contract")
      .option(
        "--chain-id <chainId>",
        "Chain ID (default: 1)",
        (value: string) => parseInt(value),
        1,
      )
      .option(
        "--skip-cal",
        "Skip CAL filtering and fetch random transactions directly from Etherscan",
        false,
      )
      .action(async (address, options) => {
        exitCode = await cli!.handleContract(
          address,
          options.chainId,
          options.skipCal,
        );
      });

    // Contract file command
    program
      .command("contract-file <file>")
      .description("Test multiple contracts from a JSON file")
      .option(
        "--skip-cal",
        "Skip CAL filtering and fetch random transactions directly from Etherscan",
        false,
      )
      .action(async (file, options) => {
        exitCode = await cli!.handleContractFile(file, options.skipCal);
      });

    return program;
  }

  /**
   * Handle raw transaction command
   */
  async handleRawTransaction(transaction: string): Promise<number> {
    const testTransactionUseCase = this.container.get<TestTransactionUseCase>(
      TYPES.TestTransactionUseCase,
    );

    const result = await testTransactionUseCase.execute(
      {
        rawTx: transaction,
        description: "Single transaction test",
      },
      { derivationPath: this.config.derivationPath },
    );

    console.log(`\n${result.title}`);
    console.table([result.data]);

    return result.exitCode;
  }

  /**
   * Handle raw file command
   */
  async handleRawFile(file: string): Promise<number> {
    const batchTestUseCase =
      this.container.get<TestBatchTransactionFromFileUseCase>(
        TYPES.TestBatchTransactionFromFileUseCase,
      );

    const result = await batchTestUseCase.execute(file, {
      defaultDerivationPath: this.config.derivationPath,
    });

    console.log(`\n${result.title}`);
    console.table(result.resultsTable);
    console.log(`\n${result.summaryTitle}`);
    console.table(result.summaryTable);

    return result.exitCode;
  }

  /**
   * Handle typed data command
   */
  async handleTypedData(data: string): Promise<number> {
    const testTypedDataUseCase = this.container.get<TestTypedDataUseCase>(
      TYPES.TestTypedDataUseCase,
    );

    const result = await testTypedDataUseCase.execute(
      { data, description: "single typed data" },
      { derivationPath: this.config.derivationPath },
    );

    console.log(`\n${result.title}`);
    console.table([result.data]);

    return result.exitCode;
  }

  /**
   * Handle typed data file command
   */
  async handleTypedDataFile(file: string): Promise<number> {
    const batchTestUseCase =
      this.container.get<TestBatchTypedDataFromFileUseCase>(
        TYPES.TestBatchTypedDataFromFileUseCase,
      );

    const result = await batchTestUseCase.execute(file, {
      defaultDerivationPath: this.config.derivationPath,
    });

    console.log(`\n${result.title}`);
    console.table(result.resultsTable);
    console.log(`\n${result.summaryTitle}`);
    console.table(result.summaryTable);

    return result.exitCode;
  }

  /**
   * Handle contract command
   */
  async handleContract(
    address: string,
    chainId: number,
    skipCal: boolean = false,
  ): Promise<number> {
    const testContractUseCase = this.container.get<TestContractUseCase>(
      TYPES.TestContractUseCase,
    );

    const result = await testContractUseCase.execute({
      contractAddress: address,
      chainId,
      derivationPath: this.config.derivationPath,
      skipCal,
    });

    console.log(`\n${result.title}`);
    console.table(result.resultsTable);
    console.log(`\n${result.summaryTitle}`);
    console.table(result.summaryTable);

    return result.exitCode;
  }

  /**
   * Handle contract file command
   */
  async handleContractFile(
    file: string,
    skipCal: boolean = false,
  ): Promise<number> {
    const batchTestUseCase =
      this.container.get<TestBatchContractFromFileUseCase>(
        TYPES.TestBatchContractFromFileUseCase,
      );

    const result = await batchTestUseCase.execute(file, {
      defaultDerivationPath: this.config.derivationPath,
      skipCal,
      plugin: this.config.plugin,
    });

    console.log(`\n${result.title}`);
    console.table(result.resultsTable);
    console.log(`\n${result.summaryTitle}`);
    console.table(result.summaryTable);

    return result.exitCode;
  }
}

// Main execution when run directly
async function main() {
  try {
    const program = EthereumTransactionTesterCli.createProgram();

    // Parse command line arguments
    await program.parseAsync(process.argv);
  } catch (error) {
    console.error("Unhandled error:", error);
    process.exit(1);
  }
}

// Export for use as module and run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error("Unhandled error:", error);
    process.exit(1);
  });
}

export { main as runCli };
