export type TransactionSubset = {
  chainId: number;
  data: string; // only used by external plugin loader
  selector: string;
  to?: string;
  value?: bigint;
};
