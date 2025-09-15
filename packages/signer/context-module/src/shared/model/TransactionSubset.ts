export type TransactionSubset = {
  chainId: number;
  data: string;
  selector: string;
  to?: string;
  value?: bigint;
  from?: string;
};
