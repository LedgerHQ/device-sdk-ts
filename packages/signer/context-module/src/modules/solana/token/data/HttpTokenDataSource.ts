import { DmkNetworkClient } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import { networkTypes } from "@/shared/network/di/networkTypes";

import {
  GetTokenInfosParams,
  TokenDataResponse,
  TokenDataSource,
} from "./TokenDataSource";

@injectable()
export class HttpTokenDataSource implements TokenDataSource {
  constructor(
    @inject(configTypes.Config)
    private readonly config: ContextModuleServiceConfig,
    @inject(networkTypes.NetworkClient)
    private readonly http: DmkNetworkClient,
  ) {}

  public async getTokenInfosPayload({
    tokenInternalId,
  }: GetTokenInfosParams): Promise<Either<Error, TokenDataResponse>> {
    try {
      const data = (await this.http.get(`${this.config.cal.url}/tokens`, {
        params: {
          id: tokenInternalId,
          output:
            "id,name,network,network_family,network_type,exchange_app_config_serialized,live_signature,ticker,decimals,blockchain_name,chain_id,contract_address,descriptor,descriptor_exchange_app,units,symbol",
          ref: `branch:${this.config.cal.branch}`,
        },
      })) as TokenDataResponse[];

      if (!data || data.length === 0 || !data[0]) {
        return Left(
          new Error(
            `[ContextModule] HttpTokenDataSource: no token metadata for id ${tokenInternalId}`,
          ),
        );
      }

      return Right(data[0]);
    } catch (_error) {
      return Left(
        new Error(
          "[ContextModule] HttpTokenDataSource: Failed to fetch token informations",
        ),
      );
    }
  }
}
