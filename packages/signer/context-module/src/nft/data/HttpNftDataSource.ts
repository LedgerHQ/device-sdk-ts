import axios from "axios";
import { injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import {
  GetNftInformationsParams,
  GetSetPluginPayloadParams,
  NftDataSource,
} from "@/nft/data/NftDataSource";
import PACKAGE from "@root/package.json";

@injectable()
export class HttpNftDataSource implements NftDataSource {
  public async getSetPluginPayload({
    chainId,
    address,
    selector,
  }: GetSetPluginPayloadParams): Promise<Either<Error, string>> {
    try {
      const response = await axios.request<{ payload: string }>({
        method: "GET",
        url: `https://nft.api.live.ledger.com/v1/ethereum/${chainId}/contracts/${address}/plugin-selector/${selector}`,
        headers: {
          "X-Ledger-Client-Version": `context-module/${PACKAGE.version}`,
        },
      });

      return response.data.payload
        ? Right(response.data.payload)
        : Left(
            new Error(
              "[ContextModule] HttpNftDataSource: unexpected empty response",
            ),
          );
    } catch (error) {
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
        url: `https://nft.api.live.ledger.com/v1/ethereum/${chainId}/contracts/${address}`,
        headers: {
          "X-Ledger-Client-Version": `context-module/${PACKAGE.version}`,
        },
      });

      return response.data.payload
        ? Right(response.data.payload)
        : Left(new Error("[ContextModule] HttpNftDataSource: no nft metadata"));
    } catch (error) {
      return Left(
        new Error(
          "[ContextModule] HttpNftDataSource: Failed to fetch nft informations",
        ),
      );
    }
  }
}
