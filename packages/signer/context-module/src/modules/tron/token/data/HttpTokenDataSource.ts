import { DmkNetworkClient } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { type Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import {
  type GetTokenInfosParams,
  tokenDataResponsesCodec,
  type TokenDataSource,
} from "@/modules/tron/token/data/TokenDataSource";
import { networkTypes } from "@/shared/network/di/networkTypes";

@injectable()
export class HttpTokenDataSource implements TokenDataSource {
  constructor(
    @inject(configTypes.Config)
    private readonly config: ContextModuleServiceConfig,
    @inject(networkTypes.NetworkClient)
    private readonly http: DmkNetworkClient,
  ) {}

  /**
   * Unlike the EVM descriptor, which is assembled from `descriptor.data` plus a
   * signature, the whole TRC10 payload the device expects is the signature
   * field: a protobuf `TokenDetails` the app checks against its built-in key.
   * `descriptor.data` is empty for these entries.
   */
  public async getTokenInfosPayload({
    assetId,
  }: GetTokenInfosParams): Promise<Either<Error, string>> {
    const noTokenMetadata = () =>
      Left(
        new Error(
          `[ContextModule] HttpTokenDataSource: no token metadata for asset id ${assetId}`,
        ),
      );

    try {
      const response = await this.http.get(`${this.config.cal.url}/tokens`, {
        params: {
          id: `tron/trc10/${assetId}`,
          output: "id,ticker,decimals,descriptor",
          ref: `branch:${this.config.cal.branch}`,
        },
      });

      return tokenDataResponsesCodec.decode(response).caseOf({
        Left: noTokenMetadata,
        Right: (entries) => {
          const payload =
            entries[0]?.descriptor.signatures[this.config.cal.mode];

          return payload === undefined || payload.length === 0
            ? noTokenMetadata()
            : Right(payload);
        },
      });
    } catch (_error) {
      return Left(
        new Error(
          "[ContextModule] HttpTokenDataSource: Failed to fetch token informations",
        ),
      );
    }
  }
}
