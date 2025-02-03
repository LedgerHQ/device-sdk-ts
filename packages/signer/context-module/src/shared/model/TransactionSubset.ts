export type TransactionSubset = {
  chainId: number;
  to?: string;
  data?: string;
  from?: string;
  rawTx?: string;
};
