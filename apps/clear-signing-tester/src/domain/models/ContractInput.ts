/**
 * Domain model representing a contract input for testing
 */
export type ContractInput = {
  name: string;
  owner: string;
  address: Record<string, string>; // chainId -> contract address
};

/**
 * Contract file format
 */
export type ContractFileData = {
  test: ContractInput[];
};
