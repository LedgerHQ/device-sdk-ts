/**
 * Domain model representing the configuration for the Etherscan service
 */
export interface EtherscanConfig {
    apiKey: string;
    baseUrl?: string;
    timeout?: number;
}
