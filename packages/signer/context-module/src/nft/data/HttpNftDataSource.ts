import { DmkNetworkClient } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import { networkTypes } from "@/network/di/networkTypes";
import {
  GetNftInformationsParams,
  GetSetPluginPayloadParams,
  NftDataSource,
} from "@/nft/data/NftDataSource";

@injectable()
export class HttpNftDataSource implements NftDataSource {
  constructor(
    @inject(configTypes.Config)
    private readonly config: ContextModuleServiceConfig,
    @inject(networkTypes.NetworkClient)
    private readonly http: DmkNetworkClient,
  ) {}

  public async getSetPluginPayload({
    chainId,
    address,
    selector,
  }: GetSetPluginPayloadParams): Promise<Either<Error, string>> {
    try {
      const data = (await this.http.get(
        `${this.config.metadataServiceDomain.url}/v1/ethereum/${chainId}/contracts/${address}/plugin-selector/${selector}`,
      )) as { payload: string };

      return data.payload
        ? Right(data.payload)
        : Left(
            new Error(
              "[ContextModule] HttpNftDataSource: unexpected empty response",
            ),
          );
    } catch (_error) {
      return Left(
        new Error(
          "[ContextModule] HttpNftDataSource: Failed to fetch set plugin payload",
        ),
      );
    }
  }

  public async getNftInfosPayload({
    chainId,
    address,
  }: GetNftInformationsParams): Promise<Either<Error, string>> {
    try {
      const data = (await this.http.get(
        `${this.config.metadataServiceDomain.url}/v1/ethereum/${chainId}/contracts/${address}`,
      )) as { payload: string };

      return data.payload
        ? Right(data.payload)
        : Left(new Error("[ContextModule] HttpNftDataSource: no nft metadata"));
    } catch (_error) {
      return Left(
        new Error(
          "[ContextModule] HttpNftDataSource: Failed to fetch nft informations",
        ),
      );
    }
  }
}
