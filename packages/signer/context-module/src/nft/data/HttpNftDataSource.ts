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
  }: GetSetPluginPayloadParams): Promise<Either<Error, string | undefined>> {
    try {
      const response = await axios.request<{ payload: string }>({
        method: "GET",
        url: `https://nft.api.live.ledger.com/v1/ethereum/${chainId}/contracts/${address}/plugin-selector/${selector}`,
        headers: {
          "X-Ledger-Client-Version": `context-module/${PACKAGE.version}`,
        },
      });

      return Right(response.data.payload);
    } catch (error) {
      return Left(new Error("Failed to fetch set plugin payload"));
    }
  }

  public async getNftInfosPayload({
    chainId,
    address,
  }: GetNftInformationsParams): Promise<Either<Error, string | undefined>> {
    try {
      const response = await axios.request<{ payload: string }>({
        method: "GET",
        url: `https://nft.api.live.ledger.com/v1/ethereum/${chainId}/contracts/${address}`,
        headers: {
          "X-Ledger-Client-Version": `context-module/${PACKAGE.version}`,
        },
      });

      return Right(response.data.payload);
    } catch (error) {
      return Left(new Error("Failed to fetch nft informations"));
    }
  }
}
