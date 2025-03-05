import type { Web3CheckTypedData } from "@/web3-check/domain/web3CheckTypes";

export type GetWeb3ChecksRequestDto =
  | {
      msg: {
        from: string;
        data: Web3CheckTypedData;
      };
    }
  | {
      tx: {
        from: string;
        raw: string;
      };
      chain: number;
    };

export type Web3CheckDto = {
  public_key_id: string;
  descriptor: string;
};
