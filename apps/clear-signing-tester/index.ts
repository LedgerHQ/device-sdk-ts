#!/usr/bin/env node

import { readFileSync, writeFileSync } from "fs";
import {
    DeviceManagementKitBuilder,
    hexaStringToBuffer,
} from "@ledgerhq/device-management-kit";
import {
    SignerEth,
    SignerEthBuilder,
} from "@ledgerhq/device-signer-kit-ethereum";
import {
    speculosIdentifier,
    speculosTransportFactory,
} from "@ledgerhq/device-transport-kit-speculos";
import {
    EtherscanService,
    EtherscanTransaction,
} from "./src/services/EtherscanService";
import { ethers } from "ethers";
import {
    rejectTxOnDevice,
    rejectTxCheck,
    ackBlindSignOnDevice,
} from "./src/DeviceInteractor";

// Types for the configuration files
interface RawTransaction {
    derivationPath: string;
    rawTx: string;
    description?: string;
}

interface DAppConfig {
    name: string;
    contracts: DAppContract[];
}

interface DAppContract {
    name: string;
    address: string;
    supportedMethods: {
        methodId: string;
        functionName: string;
    }[];
    unsupportedMethods: {
        methodId: string;
        functionName: string;
    }[];
}

interface RawTransactionResult {
    index: number;
    description: string;
    status: "success" | "error";
    timestamp: string;
}

interface DAppTransactionResult {
    dapp: string;
    contract: string;
    txHash: string;
    status: "success" | "error";
    timestamp: string;
}

// Configuration
const SPECULOS_URL = process.env["SPECULOS_URL"] || "http://localhost:5001";
const ETHERSCAN_API_KEY =
    process.env["ETHERSCAN_API_KEY"] || "1N6ZD6EPKZ3DYKGXW4BWD3GBS7XRV99EC9";
const DERIVATION_PATH = "44'/60'/0'/0/0";
const GATED_TOKEN = process.env["GATED_TOKEN"] || "test-origin-token";

// Initialize Device Management Kit with Speculos transport
const dmk = new DeviceManagementKitBuilder()
    .addTransport(speculosTransportFactory(SPECULOS_URL))
    .build();

class EthereumTransactionTester {
    private sessionId: string | null = null;
    private signer: SignerEth | null = null;
    private etherscanService: EtherscanService | null = null;
    _rejectTimeout: any; 
    interactiveMode: boolean = false;

    async initialize() {
        console.log("🔧 Initializing Device Management Kit...");

        try {
            // Initialize Etherscan service if API key is provided
            if (ETHERSCAN_API_KEY) {
                this.etherscanService = new EtherscanService({
                    apiKey: ETHERSCAN_API_KEY,
                    timeout: 30000,
                });
                console.log("✅ Etherscan service initialized");
            }

            // Connect to device
            const selectedTransport = speculosIdentifier;
            dmk.startDiscovering({ transport: selectedTransport }).subscribe({
                next: (device) => {
                    dmk.connect({
                        device: device,
                        sessionRefresherOptions: { isRefresherDisabled: true },
                    }).then((sessionId) => {
                        this.sessionId = sessionId;
                        console.log(
                            `✅ Device connected with session ID: ${this.sessionId}`,
                        );
                        this.initializeSigner();
                    });
                },
                error: (error: any) => {
                    console.error("❌ Error connecting to device:", error);
                    process.exit(1);
                },
            });
        } catch (error) {
            console.error("❌ Failed to initialize DMK:", error);
            process.exit(1);
        }
    }

    private initializeSigner(gated: boolean = false) {
        if (!this.sessionId) {
            throw new Error("No active session");
        }

        this.signer = new SignerEthBuilder({
            dmk,
            sessionId: this.sessionId,
            originToken: gated ? "test-origin-token" : GATED_TOKEN, // Replace with actual token if needed
        }).build();

        console.log("✅ Ethereum signer initialized");
    }

    async testRawTransactions(
        rawTransactionsFile: string,
        gated: boolean = false,
    ): Promise<RawTransactionResult[]> {
        this.initializeSigner(gated);
        console.log(`📄 Testing raw transactions from: ${rawTransactionsFile}`);

        try {
            const fileContent = readFileSync(rawTransactionsFile, "utf-8");
            const transactions: RawTransaction[] = JSON.parse(fileContent);

            const results: RawTransactionResult[] = [];

            for (const [index, tx] of transactions.entries()) {
                console.log(
                    `    🔄 Testing RAW transaction ${index + 1}/${transactions.length}:`,
                );

                try {
                    console.log(`🔍 Transaction data: ${tx.rawTx}`);

                    // Use the sanitizeTransaction method
                    const result = await this.signTransaction(
                        DERIVATION_PATH,
                        tx.rawTx,
                    );
                    // Check if result is a timeout response - treat as success

                    results.push({
                        index: index,
                        description: tx.description || "",
                        status: "success",
                        timestamp: result.timestamp,
                    });
                    console.log(
                        `    ✅ Transaction ${tx.description} successfully cleared signed`,
                    );
                } catch (error) {
                    console.error(
                        `    ❌ Transaction ${tx.description} failed to be cleared signed`,
                    );
                    results.push({
                        index: index,
                        description: tx.description || "",
                        status: "error",
                        timestamp: new Date().toISOString(),
                    });
                }
            }
            // Save results
            const resultsFile = `raw-transactions-results-${Date.now()}.json`;
            writeFileSync(resultsFile, JSON.stringify(results, null, 2));
            console.log(`\n📊 Results saved to: ${resultsFile}`);
            return results;
        } catch (error) {
            console.error("❌ Error reading raw transactions file:", error);
            throw error;
        }
    }

    async testDAppTransactions(
        dappsFile: string,
    ): Promise<DAppTransactionResult[]> {
        console.log(`📄 Testing dApp transactions from: ${dappsFile}`);

        if (!this.etherscanService) {
            throw new Error(
                "ETHERSCAN_API_KEY environment variable is required for dApp testing",
            );
        }

        try {
            const fileContent = readFileSync(dappsFile, "utf-8");
            const dapps: DAppConfig[] = JSON.parse(fileContent);

            const results: DAppTransactionResult[] = [];

            for (const dapp of dapps) {
                console.log(`\n🏦 Testing dApp: ${dapp.name}`);

                for (const contract of dapp.contracts) {
                    console.log(`  📋 Contract: ${contract.name} with address ${contract.address}`);

                    try {
                        const transactions =
                            await this.etherscanService!.getContractTransactions(
                                contract.address,
                                10,
                            );

                        for (const [index, tx] of transactions.entries()) {
                            console.log(
                                `    🔄 Testing transaction ${index + 1}/${transactions.length}: ${tx.hash}`,
                            );

                            try {
                                console.log(
                                    `\n🔍 Transaction data: ${JSON.stringify(tx)}\n`,
                                );

                                // Use the sanitizeTransaction method
                                const sanitizedTx =
                                    this.sanitizeTransaction(tx);
                                
                                const ethersTx =
                                    ethers.Transaction.from(
                                        sanitizedTx,
                                    );
                                    ethersTx.data
                                const rawTx = ethersTx.unsignedSerialized;
                                const result = await this.signTransaction(
                                    DERIVATION_PATH,
                                    rawTx,
                                );

                                // Check if result is a timeout response - treat as success
                                results.push({
                                    dapp: dapp.name,
                                    contract: contract.name,
                                    txHash: tx.hash,
                                    status: "success",
                                    timestamp: result?.timestamp,
                                });

                                console.log(
                                    `    ✅ Transaction ${tx.hash} is successfully cleared signed\n\n\n`,
                                );
                            } catch (error) {
                                console.error(
                                    `    ❌ Transaction ${tx.hash} failed:`,
                                    error,
                                );
                                results.push({
                                    dapp: dapp.name,
                                    contract: contract.name,
                                    txHash: tx.hash,
                                    status: "error",
                                    timestamp: new Date().toISOString(),
                                });
                            }
                        }
                    } catch (error) {
                        console.error(
                            `  ❌ Error fetching transactions for contract ${contract.name} from dApp ${dapp.name}:`,
                            error,
                        );
                    }
                }
            }

            // Save results
            const resultsFile = `dapp-transactions-results-${Date.now()}.json`;
            writeFileSync(resultsFile, JSON.stringify(results, null, 2));
            console.log(`\n📊 Results saved to: ${resultsFile}`);

            return results;
        } catch (error) {
            console.error("❌ Error reading dApps file:", error);
            throw error;
        }
    }

    private async signTransaction(
        derivationPath: string,
        rawTx: string,
    ): Promise<any> {
        if (!this.signer) {
            throw new Error("Signer not initialized");
        }

        // Convert hex string to buffer
        const txBuffer = hexaStringToBuffer(rawTx);
        if (!txBuffer) {
            throw new Error("Invalid transaction format");
        }

        // Sign the transaction
        const { observable } = this.signer.signTransaction(
            derivationPath,
            txBuffer,
            {
                skipOpenApp: true,
            },
        );

        return new Promise((resolve, reject) => {
            observable.subscribe({
                next: async (state: any) => {
                    if (
                        state.status === "pending" &&
                        state.intermediateValue?.requiredUserInteraction ===
                            "sign-transaction"
                    ) {
                        // Set up a 2-second timeout to call rejectTxOnDevice, but cancel if a new state is emitted
                        this._rejectTimeout = setTimeout(async () => {
                            if (!this.interactiveMode) {
                                rejectTxOnDevice();
                            }
                            this._rejectTimeout = null;
                        }, 2000);
                        return;
                    } else if (
                        state.status === "pending" &&
                        state.intermediateValue?.requiredUserInteraction ===
                            "web3-checks-opt-in"
                    ) {
                        await rejectTxCheck();
                        return;
                    }

                    if (
                        state.status === "error" &&
                        state.error?.errorCode === "6985"
                    ) {
                        console.log("🔐 Transaction clear signed ✅");
                        await new Promise((resolve) =>
                            setTimeout(resolve, 2000),
                        ); // Wait for device to be ready
                        resolve({
                            status: "completed",
                            message:
                                "Transaction signing completed successfully",
                            timestamp: new Date().toISOString(),
                        });
                        return;
                    }

                    // Handle error state
                    if (state.status === "error") {
                        console.error(`❌ Transaction BLIND SIGNED`);
                        if (this._rejectTimeout) {
                            clearTimeout(this._rejectTimeout);
                        }
                        if (!this.interactiveMode) {
                            await ackBlindSignOnDevice();
                        }
                        reject(
                            new Error(
                                state.error?.message ||
                                    "Transaction signing failed",
                            ),
                        );
                        return;
                    }
                },
                error: (error: any) => {
                    console.error("❌ Observable error:", error);
                    reject(error);
                },
            });
        });
    }

    async cleanup() {
        if (this.sessionId) {
            try {
                await dmk.disconnect({ sessionId: this.sessionId });
                console.log("🔌 Device disconnected");
            } catch (error) {
                console.error("❌ Error disconnecting device:", error);
            }
        }
    }

    private sanitizeTransaction(tx: EtherscanTransaction): object {
        const allowedFields = [
            "to",
            "value",
            "gasLimit",
            "maxPriorityFeePerGas",
            "maxFeePerGas",
            "nonce",
            "type",
            "chainId",
            "input",
        ];
        try {
            const sanitized: Partial<EtherscanTransaction> & {
                data: string;
                chainId: number;
            } = {
                chainId: 1,
                data: "",
            };
            for (const key of allowedFields) {
                const typedKey = key as keyof EtherscanTransaction;
                if (tx[typedKey] !== undefined) {
                    if (typedKey === "input") {
                        sanitized["data"] = tx[typedKey];
                    } else {
                        sanitized[typedKey] = tx[typedKey];
                    }
                }
            }
            return sanitized;
        } catch (e) {
            throw new Error(
                `Failed to sanitize transaction: ${e instanceof Error ? e.message : String(e)}`,
            );
        }
    }
}

// Main execution function
async function main() {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log(`
Usage: npm run test:eth [options]

Options:
  --raw <file>     Test raw transactions from JSON file
  --dapps <file>   Test dApp transactions from JSON file
  --both <raw> <dapps>  Test both raw and dApp transactions

Examples:
  npm run test:eth --raw examples/raw-transactions.json
  npm run test:eth --dapps examples/dapps.json
  npm run test:eth --both examples/raw-transactions.json examples/dapps.json

Environment variables:
  SPECULOS_URL     Speculos server URL (default: http://localhost:5000)
  ETHERSCAN_API_KEY Etherscan API key (required for dApp testing)
    `);
        process.exit(1);
    }

    const tester = new EthereumTransactionTester();

    try {
        await tester.initialize();

        // Wait a bit for device connection
        await new Promise((resolve) => setTimeout(resolve, 1000));

        if (args[2] === "--interactive") {
            console.log("🔄 Interactive mode enabled");
            tester.interactiveMode = true;
        }

        if (args[0] === "--raw" && args[1]) {
            await tester.testRawTransactions(args[1]);
        } else if (args[0] === "--dapps" && args[1]) {
            await tester.testDAppTransactions(args[1]);
        } else if (args[0] === "--both" && args[1] && args[2]) {
            await tester.testRawTransactions(args[1]);
            await tester.testDAppTransactions(args[2]);
        } else {
            console.error("❌ Invalid arguments");
            process.exit(1);
        }


        console.log("\n✅ Testing completed successfully");
    } catch (error) {
        console.error("❌ Testing failed:", error);
        process.exit(1);
    } finally {
        await tester.cleanup();
        process.exit(0);
    }
}

// Run the script
if (require.main === module) {
    main().catch((_error) => {
        //console.error('❌ Unhandled error:', error);
        process.exit(1);
    });
}

export { EthereumTransactionTester };
