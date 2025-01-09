export type Web3CheckContext = {
  from: string;
  rawTx: string;
  chainId: number;
};

export type Web3Checks = {
  publicKeyId: string;
  descriptor: string;
};
