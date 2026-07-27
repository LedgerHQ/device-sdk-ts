import { DmkNetworkClient } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import { networkTypes } from "@/shared/network/di/networkTypes";

import {
  type GetIdFromMintParams,
  type MintToIdDataSource,
} from "./MintToIdDataSource";

@injectable()
export class HttpMintToIdDataSource implements MintToIdDataSource {
  constructor(
    @inject(configTypes.Config)
    private readonly config: ContextModuleServiceConfig,
    @inject(networkTypes.NetworkClient)
    private readonly http: DmkNetworkClient,
  ) {}

  public async getIdFromMint({
    mintAddress,
  }: GetIdFromMintParams): Promise<Either<Error, string>> {
    try {
      const data = (await this.http.get(`${this.config.cal.url}/tokens`, {
        params: {
          contract_address: mintAddress,
          network: "solana",
          output: "id",
          ref: `branch:${this.config.cal.branch}`,
        },
      })) as Array<{ id?: string }>;

      if (!data || data.length === 0 || !data[0]?.id) {
        return Left(
          new Error(
            `[ContextModule] HttpMintToIdDataSource: no token id found for mint ${mintAddress}`,
          ),
        );
      }

      return Right(data[0].id);
    } catch (_error) {
      return Left(
        new Error(
          "[ContextModule] HttpMintToIdDataSource: failed to fetch token id from mint address",
        ),
      );
    }
  }
}
