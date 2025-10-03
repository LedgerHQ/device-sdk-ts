#!/usr/bin/env node

import { Command } from "commander";
import {
    makeContainer,
    ClearSigningTesterConfig,
    TYPES,
} from "../di/container";
import { ConsoleLogger, LogLevel } from "@ledgerhq/device-management-kit";
import { Container } from "inversify";
import { TestBatchTransactionFromFileUseCase } from "../application/usecases/TestBatchTransactionFromFileUseCase";
import { TestTransactionUseCase } from "../application/usecases/TestTransactionUseCase";
import { TestTypedDataUseCase } from "../application/usecases/TestTypedDataUseCase";
import { TestBatchTypedDataFromFileUseCase } from "../application/usecases/TestBatchTypedDataFromFileUseCase";
import { ServiceController } from "../domain/services/ServiceController";

export interface CliConfig {
    derivationPath: string;
    speculosUrl: string;
    speculosPort: number;
    verbose: boolean;
    quiet: boolean;
    device: "stax" | "nanox";
}

/**
 * CLI for EthereumTransactionTester
 *
 * Provides a command-line interface for testing Ethereum transactions
 * using the clean architecture EthereumTransactionTester with dependency injection.
 * This is the composition root of the application.
 */
export class EthereumTransactionTesterCli {
    public container: Container;

    constructor(config: CliConfig) {
        const logger = new ConsoleLogger(
            config.quiet
                ? LogLevel.Error
                : config.verbose
                  ? LogLevel.Debug
                  : LogLevel.Info,
        );

        const randomPort = Math.floor(Math.random() * 10000) + 10000;

        // Create DI container configuration
        const diConfig: ClearSigningTesterConfig = {
            speculos: {
                url: config.speculosUrl || `http://localhost`,
                port: config.speculosPort || randomPort,
                device: config.device,
            },
            signer: {
                originToken: process.env["GATED_TOKEN"] || "test-origin-token",
                gated: true,
            },
            etherscan: {
                apiKey: process.env["ETHERSCAN_API_KEY"] || "default-key",
            },
        };

        // Create DI container and resolve tester
        this.container = makeContainer({
            config: diConfig,
            loggers: [logger],
        });
    }

    /**
     * Create Commander.js program with all CLI commands
     */
    static createProgram(): Command {
        const program = new Command();

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
                this.validatePort,
            )
            .option(
                "--device <device>",
                "Device type (stax or nanox, default: stax)",
                this.validateDevice,
                "stax",
            )
            .option("--verbose, -v", "Enable verbose output", false)
            .option(
                "--quiet, -q",
                "Show only result tables (quiet mode)",
                false,
            );

        // Raw transaction command
        program
            .command("raw-transaction <transaction>")
            .description("Test a single raw transaction")
            .action(async (transaction, _, command) => {
                const globalOpts = command.parent!.opts();
                await this.handleRawTransaction(transaction, globalOpts);
            });

        // Raw file command
        program
            .command("raw-file <file>")
            .description("Test multiple raw transactions from a JSON file")
            .action(async (file, _, command) => {
                const globalOpts = command.parent!.opts();
                await this.handleRawFile(file, globalOpts);
            });

        // Typed data command
        program
            .command("typed-data <data>")
            .description("Test a single typed data object (JSON string)")
            .action(async (data, _, command) => {
                const globalOpts = command.parent!.opts();
                await this.handleTypedData(data, globalOpts);
            });

        // Typed data file command
        program
            .command("typed-data-file <file>")
            .description("Test multiple typed data objects from a JSON file")
            .action(async (file, _, command) => {
                const globalOpts = command.parent!.opts();
                await this.handleTypedDataFile(file, globalOpts);
            });

        return program;
    }

    /**
     * Validate device option
     */
    private static validateDevice(
        value: string,
    ): (typeof supportedDevices)[number] {
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
    }

    /**
     * Validate port option
     */
    private static validatePort(value: string): number {
        const port = parseInt(value);
        if (isNaN(port) || port < 1 || port > 65535) {
            throw new Error("Invalid port number");
        }
        return port;
    }

    /**
     * Handle raw transaction command
     */
    private static async handleRawTransaction(
        transaction: string,
        globalOpts: any,
    ): Promise<void> {
        const config: CliConfig = {
            derivationPath: globalOpts.derivationPath,
            speculosUrl: globalOpts.speculosUrl,
            speculosPort: globalOpts.speculosPort,
            verbose: globalOpts.verbose,
            quiet: globalOpts.quiet,
            device: globalOpts.device,
        };

        const cli = new EthereumTransactionTesterCli(config);
        const speculosController = cli.container.get<ServiceController>(
            TYPES.SpeculosServiceController,
        );
        await speculosController.start();
        const dmkController = cli.container.get<ServiceController>(
            TYPES.DMKServiceController,
        );
        await dmkController.start();
        const testTransactionUseCase =
            cli.container.get<TestTransactionUseCase>(
                TYPES.TestTransactionUseCase,
            );

        const result = await testTransactionUseCase.execute(
            {
                rawTx: transaction,
                description: "Single transaction test",
            },
            { derivationPath: config.derivationPath },
        );

        const code = result.status === "clear_signed" ? 0 : 1;

        await dmkController.stop();
        await speculosController.stop();

        process.exit(code);
    }

    /**
     * Handle raw file command
     */
    private static async handleRawFile(
        file: string,
        globalOpts: any,
    ): Promise<void> {
        const config: CliConfig = {
            derivationPath: globalOpts.derivationPath,
            speculosUrl: globalOpts.speculosUrl,
            speculosPort: globalOpts.speculosPort,
            verbose: globalOpts.verbose,
            quiet: globalOpts.quiet,
            device: globalOpts.device,
        };

        const cli = new EthereumTransactionTesterCli(config);

        const speculosController = cli.container.get<ServiceController>(
            TYPES.SpeculosServiceController,
        );
        await speculosController.start();
        const dmkController = cli.container.get<ServiceController>(
            TYPES.DMKServiceController,
        );
        await dmkController.start();
        const batchTestUseCase =
            cli.container.get<TestBatchTransactionFromFileUseCase>(
                TYPES.TestBatchTransactionFromFileUseCase,
            );

        const result = await batchTestUseCase.execute(file, {
            defaultDerivationPath: config.derivationPath,
        });

        const code = result.totalItems - result.clearSignedCount;

        await dmkController.stop();
        await speculosController.stop();

        process.exit(code);
    }

    /**
     * Handle typed data command
     */
    private static async handleTypedData(
        data: string,
        globalOpts: any,
    ): Promise<void> {
        const config: CliConfig = {
            derivationPath: globalOpts.derivationPath,
            speculosUrl: globalOpts.speculosUrl,
            speculosPort: globalOpts.speculosPort,
            verbose: globalOpts.verbose,
            quiet: globalOpts.quiet,
            device: globalOpts.device,
        };

        const cli = new EthereumTransactionTesterCli(config);
        const speculosController = cli.container.get<ServiceController>(
            TYPES.SpeculosServiceController,
        );
        await speculosController.start();
        const dmkController = cli.container.get<ServiceController>(
            TYPES.DMKServiceController,
        );
        await dmkController.start();
        const testTypedDataUseCase = cli.container.get<TestTypedDataUseCase>(
            TYPES.TestTypedDataUseCase,
        );

        const result = await testTypedDataUseCase.execute(
            { data, description: "single typed data" },
            { derivationPath: config.derivationPath },
        );

        const code = result.status === "clear_signed" ? 0 : 1;

        await dmkController.stop();
        await speculosController.stop();

        process.exit(code);
    }

    /**
     * Handle typed data file command
     */
    private static async handleTypedDataFile(
        file: string,
        globalOpts: any,
    ): Promise<void> {
        const config: CliConfig = {
            derivationPath: globalOpts.derivationPath,
            speculosUrl: globalOpts.speculosUrl,
            speculosPort: globalOpts.speculosPort,
            verbose: globalOpts.verbose,
            quiet: globalOpts.quiet,
            device: globalOpts.device,
        };

        const cli = new EthereumTransactionTesterCli(config);
        const speculosController = cli.container.get<ServiceController>(
            TYPES.SpeculosServiceController,
        );
        await speculosController.start();
        const dmkController = cli.container.get<ServiceController>(
            TYPES.DMKServiceController,
        );
        await dmkController.start();
        const batchTestUseCase =
            cli.container.get<TestBatchTypedDataFromFileUseCase>(
                TYPES.TestBatchTypedDataFromFileUseCase,
            );

        const result = await batchTestUseCase.execute(file, {
            defaultDerivationPath: config.derivationPath,
        });

        const code = result.totalItems - result.clearSignedCount;

        await dmkController.stop();
        await speculosController.stop();

        process.exit(code);
    }
}

// Main execution when run directly
async function main() {
    try {
        const program = EthereumTransactionTesterCli.createProgram();

        // Handle graceful shutdown
        process.on("SIGINT", async () => {
            console.error("Received SIGINT, cleaning up...");
            process.exit(0);
        });

        process.on("SIGTERM", async () => {
            console.error("Received SIGTERM, cleaning up...");
            process.exit(0);
        });

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
