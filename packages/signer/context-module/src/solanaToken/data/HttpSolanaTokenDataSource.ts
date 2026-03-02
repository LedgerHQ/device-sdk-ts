import { inject, injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import { type ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import { LEDGER_CLIENT_VERSION_HEADER } from "@/shared/constant/HttpHeaders";
import PACKAGE from "@root/package.json";

import {
  GetSolanaTokenInfosParams,
  SolanaTokenDataSource,
  TokenDataResponse,
} from "./SolanaTokenDataSource";

@injectable()
export class HttpSolanaTokenDataSource implements SolanaTokenDataSource {
  constructor(
    @inject(configTypes.Config) private readonly config: ContextModuleConfig,
  ) {}
  public async getTokenInfosPayload({
    tokenInternalId,
  }: GetSolanaTokenInfosParams): Promise<Either<Error, TokenDataResponse>> {
    try {
      const url = new URL(`${this.config.cal.url}/tokens`);
      url.searchParams.set("id", tokenInternalId);
      url.searchParams.set(
        "output",
        "id,name,network,network_family,network_type,exchange_app_config_serialized,live_signature,ticker,decimals,blockchain_name,chain_id,contract_address,descriptor,descriptor_exchange_app,units,symbol",
      );
      url.searchParams.set("ref", `branch:${this.config.cal.branch}`);
      const response = await fetch(url, {
        headers: {
          [LEDGER_CLIENT_VERSION_HEADER]: `context-module/${PACKAGE.version}`,
        },
      });
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      const data = (await response.json()) as TokenDataResponse[];

      if (!data || data.length === 0 || !data[0]) {
        return Left(
          new Error(
            `[ContextModule] HttpSolanaTokenDataSource: no token metadata for id ${tokenInternalId}`,
          ),
        );
      }

      return Right(data[0]);
    } catch (_error) {
      return Left(
        new Error(
          "[ContextModule] HttpSolanaTokenDataSource: Failed to fetch token informations",
        ),
      );
    }
  }
}
