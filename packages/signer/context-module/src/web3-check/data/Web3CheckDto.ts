import type { Web3CheckTypedData } from "@/web3-check/domain/web3CheckTypes";

export type GetWeb3ChecksTypedDataRequestDto = {
  msg: {
    from: string;
    data: Web3CheckTypedData;
  };
};

export type GetWeb3ChecksRawTxRequestDto = {
  tx: {
    from: string;
    raw: string;
  };
  chain: number;
};

export type GetWeb3ChecksRequestDto =
  | GetWeb3ChecksTypedDataRequestDto
  | GetWeb3ChecksRawTxRequestDto;

export type Web3CheckDto = {
  public_key_id: string;
  descriptor: string;
};
