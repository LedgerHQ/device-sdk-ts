import axios from "axios";
import { inject, injectable } from "inversify";

import { TYPES } from "../di/types";

// Types for Etherscan API
export type EtherscanTransaction = {
    hash: string;
    from: string;
    to: string;
    value: string;
    gas: string;
    gasPrice: string;
    nonce: string;
    blockNumber: string;
    transactionIndex: string;
    input: string;
    raw: string;
    methodId: string;
    functionName: string;
};

export interface EtherscanResponse {
    status: string;
    message: string;
    result: EtherscanTransaction[];
}

export interface EtherscanSingleResponse {
    status: string;
    message: string;
    result: EtherscanTransaction;
}

export interface EtherscanCodeResponse {
    status: string;
    message: string;
    result: string;
}

export interface EtherscanConfig {
    apiKey: string;
    baseUrl?: string;
    timeout?: number;
}

@injectable()
export class EtherscanService {
    private readonly apiKey: string;
    private readonly baseUrl: string;
    private readonly timeout: number;

    constructor(@inject(TYPES.EtherscanConfig) config: EtherscanConfig) {
        this.apiKey = config.apiKey;
        this.baseUrl = config.baseUrl || "https://api.etherscan.io/api";
        this.timeout = config.timeout || 30000;

        if (!this.apiKey) {
            throw new Error("Etherscan API key is required");
        }
    }

    /**
     * Fetch the last N transactions for a contract address
     * @param contractAddress - The contract address to fetch transactions for
     * @param limit - Number of transactions to fetch (default: 10)
     * @returns Promise<EtherscanTransaction[]>
     */
    async getContractTransactions(
        contractAddress: string,
        limit: number = 1,
    ): Promise<EtherscanTransaction[]> {
        try {
            console.log(
                `\t  🔍 Fetching ${limit} transactions for contract: ${contractAddress}`,
            );

            const response = await axios.get<EtherscanResponse>(this.baseUrl, {
                params: {
                    module: "account",
                    action: "txlist",
                    address: contractAddress,
                    startblock: 0,
                    endblock: 99999999,
                    page: 1,
                    offset: limit,
                    sort: "desc",
                    apikey: this.apiKey,
                },
                timeout: this.timeout,
            });

            if (response.data.status === "1") {
                console.log(
                    `\t  ✅ Found ${response.data.result.length} transactions for ${contractAddress}`,
                );
                return response.data.result;
            } else {
                throw new Error(
                    `Etherscan API error: ${response.data.message}`,
                );
            }
        } catch (error) {
            if (axios.isAxiosError(error)) {
                if (error.code === "ECONNABORTED") {
                    throw new Error(
                        `Timeout fetching transactions for ${contractAddress}`,
                    );
                }
                if (error.response?.status === 403) {
                    throw new Error(`Invalid API key for Etherscan`);
                }
                if (error.response?.status === 429) {
                    throw new Error(`Rate limit exceeded for Etherscan API`);
                }
                throw new Error(
                    `HTTP error fetching transactions for ${contractAddress}: ${error.message}`,
                );
            }
            throw new Error(
                `Error fetching transactions for ${contractAddress}: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    /**
     * Fetch transaction details by hash
     * @param txHash - Transaction hash
     * @returns Promise<EtherscanTransaction>
     */
    async getTransactionByHash(txHash: string): Promise<EtherscanTransaction> {
        try {
            console.log(`\t\t  🔍 Fetching transaction details for: ${txHash}`);

            const response = await axios.get<EtherscanSingleResponse>(
                this.baseUrl,
                {
                    params: {
                        module: "proxy",
                        action: "eth_getTransactionByHash",
                        txhash: txHash,
                        apikey: this.apiKey,
                    },
                    timeout: this.timeout,
                },
            );

            if (response.data.status === "1" && response.data.result) {
                console.log(`\t\t  ✅ Found transaction details for ${txHash}`);
                console.log(
                    `\t\t  Response: ${JSON.stringify(response.data.result)}`,
                );
                return response.data.result;
            } else {
                throw new Error(`Transaction not found: ${txHash}`);
            }
        } catch (error) {
            if (axios.isAxiosError(error)) {
                throw new Error(
                    `HTTP error fetching transaction ${txHash}: ${error.message}`,
                );
            }
            throw new Error(
                `Error fetching transaction ${txHash}: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    /**
     * Check if an address is a contract by fetching its bytecode
     * @param address - Ethereum address to check
     * @returns Promise<boolean> - true if the address is a contract, false otherwise
     */
    async isAddressContract(address: string): Promise<boolean> {
        try {
            console.log(`🔍 Checking if ${address} is a contract`);

            const response = await axios.get<EtherscanCodeResponse>(
                this.baseUrl,
                {
                    params: {
                        module: "proxy",
                        action: "eth_getCode",
                        address: address,
                        tag: "latest",
                        apikey: this.apiKey,
                    },
                    timeout: this.timeout,
                },
            );

            console.log(`🔍 Response: ${JSON.stringify(response.data)}`);

            if (response.data.status === "1") {
                const code = response.data.result;
                // A contract has bytecode (non-empty), while an EOA has no bytecode (0x or 0x0)
                const isContract = code !== "0x" && code !== "0x0";
                console.log(
                    `✅ ${address} is ${isContract ? "a contract" : "not a contract"}`,
                );
                return isContract;
            } else {
                throw new Error(
                    `Etherscan API error: ${response.data.message}`,
                );
            }
        } catch (error) {
            if (axios.isAxiosError(error)) {
                if (error.code === "ECONNABORTED") {
                    throw new Error(
                        `Timeout checking contract status for ${address}`,
                    );
                }
                if (error.response?.status === 403) {
                    throw new Error(`Invalid API key for Etherscan`);
                }
                if (error.response?.status === 429) {
                    throw new Error(`Rate limit exceeded for Etherscan API`);
                }
                throw new Error(
                    `HTTP error checking contract status for ${address}: ${error.message}`,
                );
            }
            throw new Error(
                `Error checking contract status for ${address}: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }
}
