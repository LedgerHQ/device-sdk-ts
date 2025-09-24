import { type Either } from "purify-ts";

export type GetSolanaTokenInfosParams = {
  tokenInternalId: string;
};

export type Unit = {
  code: string;
  name: string;
  magnitude: number;
};

export type TokenDataResponse = {
  id: string;
  blockchain_name: string;
  chain_id?: number;
  contract_address: string;
  decimals: number;
  descriptor: {
    data: string;
    descriptorType: string;
    signatures: {
      prod: string;
      test: string;
    };
  };
  descriptor_exchange_app: {
    data: string;
    descriptorType: string;
    signatures: {
      prod: string;
      test: string;
    };
  };
  exchange_app_config_serialized: string;
  name: string;
  network: string;
  network_family: string;
  network_type: "main" | "test";
  symbol: string;
  ticker: string;
  units: Unit[];
};

export interface SolanaTokenDataSource {
  getTokenInfosPayload(
    params: GetSolanaTokenInfosParams,
  ): Promise<Either<Error, TokenDataResponse>>;
}
