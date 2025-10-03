#!/usr/bin/env node

import { ConsoleLogger, LogLevel } from "@ledgerhq/device-management-kit";
import { Command } from "commander";
import { type Container } from "inversify";

import { type TestBatchTransactionFromFileUseCase } from "@root/src/application/usecases/TestBatchTransactionFromFileUseCase";
import { type TestBatchTypedDataFromFileUseCase } from "@root/src/application/usecases/TestBatchTypedDataFromFileUseCase";
import { type TestTransactionUseCase } from "@root/src/application/usecases/TestTransactionUseCase";
import { type TestTypedDataUseCase } from "@root/src/application/usecases/TestTypedDataUseCase";
import {
    type ClearSigningTesterConfig,
    makeContainer,
    TYPES,
} from "@root/src/di/container";
import { type ServiceController } from "@root/src/domain/services/ServiceController";

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
    private container: Container;
    private controller: ServiceController;
    private config: CliConfig;

    constructor(config: CliConfig) {
        this.config = config;

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
                "Device type (stax or nanox, default: stax)",
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
            .option("--verbose, -v", "Enable verbose output", false)
            .option(
                "--quiet, -q",
                "Show only result tables (quiet mode)",
                false,
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

        return program;
    }

    /**
     * Handle raw transaction command
     */
    async handleRawTransaction(transaction: string): Promise<number> {
        const testTransactionUseCase =
            this.container.get<TestTransactionUseCase>(
                TYPES.TestTransactionUseCase,
            );

        const result = await testTransactionUseCase.execute(
            {
                rawTx: transaction,
                description: "Single transaction test",
            },
            { derivationPath: this.config.derivationPath },
        );

        return result.status === "clear_signed" ? 0 : 1;
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

        return result.totalItems - result.clearSignedCount;
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

        return result.status === "clear_signed" ? 0 : 1;
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

        return result.totalItems - result.clearSignedCount;
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
