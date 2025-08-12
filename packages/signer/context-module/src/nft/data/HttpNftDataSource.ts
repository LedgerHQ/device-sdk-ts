import axios from "axios";
import { inject, injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import { type ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import {
  GetNftInformationsParams,
  GetSetPluginPayloadParams,
  NftDataSource,
} from "@/nft/data/NftDataSource";
import {
  LEDGER_CLIENT_VERSION_HEADER,
  LEDGER_ORIGIN_TOKEN_HEADER,
} from "@/shared/constant/HttpHeaders";
import PACKAGE from "@root/package.json";

@injectable()
export class HttpNftDataSource implements NftDataSource {
  constructor(
    @inject(configTypes.Config) private readonly config: ContextModuleConfig,
  ) {}

  public async getSetPluginPayload({
    chainId,
    address,
    selector,
  }: GetSetPluginPayloadParams): Promise<Either<Error, string>> {
    try {
      const response = await axios.request<{ payload: string }>({
        method: "GET",
        url: `${this.config.metadataService.url}/ethereum/${chainId}/contracts/${address}/plugin-selector/${selector}`,
        headers: {
          [LEDGER_CLIENT_VERSION_HEADER]: `context-module/${PACKAGE.version}`,
          [LEDGER_ORIGIN_TOKEN_HEADER]: this.config.originToken,
        },
      });

      return response.data.payload
        ? Right(response.data.payload)
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
      const response = await axios.request<{ payload: string }>({
        method: "GET",
        url: `${this.config.metadataService.url}/ethereum/${chainId}/contracts/${address}`,
        headers: {
          [LEDGER_CLIENT_VERSION_HEADER]: `context-module/${PACKAGE.version}`,
          [LEDGER_ORIGIN_TOKEN_HEADER]: this.config.originToken,
        },
      });

      return response.data.payload
        ? Right(response.data.payload)
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
