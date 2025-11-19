/**
 * Domain model representing the configuration for the Etherscan service
 */
export type EtherscanConfig = {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
};
