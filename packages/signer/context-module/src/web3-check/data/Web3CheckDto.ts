export type GetWeb3ChecksRequestDto = {
  tx: {
    from: string;
    raw: string;
  };
  chain: number;
  preset: string;
  block?: number;
};

export type Web3CheckDto = {
  public_key_id: string;
  descriptor: string;
  block: number;
};
