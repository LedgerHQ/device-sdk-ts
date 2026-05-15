import { type DmkNetworkClient } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { type Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import { networkTypes } from "@/network/di/networkTypes";

import {
  type AleoTokenDataResponse,
  type AleoTokenDataSource,
  type GetAleoTokenInfosParams,
} from "./AleoTokenDataSource";

@injectable()
export class HttpAleoTokenDataSource implements AleoTokenDataSource {
  constructor(
    @inject(configTypes.Config)
    private readonly config: ContextModuleServiceConfig,
    @inject(networkTypes.NetworkClient)
    private readonly http: DmkNetworkClient,
  ) {}

  public async getTokenInfosPayload({
    tokenInternalId,
    programName,
  }: GetAleoTokenInfosParams): Promise<Either<Error, AleoTokenDataResponse>> {
    try {
      const data = (await this.http.get(`${this.config.cal.url}/tokens`, {
        params: {
          id: tokenInternalId,
          ...(programName ? { program_name: programName } : {}),
          output:
            "id,name,network,network_family,network_type,ticker,decimals,blockchain_name,chain_id,contract_address,descriptor,units,symbol",
          ref: `branch:${this.config.cal.branch}`,
        },
      })) as AleoTokenDataResponse[];

      if (!data || data.length === 0 || !data[0]) {
        return Left(
          new Error(
            `[ContextModule] HttpAleoTokenDataSource: no token metadata for id ${tokenInternalId}`,
          ),
        );
      }

      return Right(data[0]);
    } catch (_error) {
      return Left(
        new Error(
          "[ContextModule] HttpAleoTokenDataSource: Failed to fetch token informations",
        ),
      );
    }
  }
}
