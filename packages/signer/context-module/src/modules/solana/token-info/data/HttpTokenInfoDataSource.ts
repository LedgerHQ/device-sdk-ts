import { DmkNetworkClient } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { Codec, Either, Left, optional, Right, string } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import { networkTypes } from "@/shared/network/di/networkTypes";

import {
  type GetTokenInfoParams,
  type TokenInfoDataSource,
  type TokenInfoResult,
} from "./TokenInfoDataSource";

const calSignaturesCodec = Codec.interface({
  prod: optional(string),
  test: optional(string),
});

// The CAL /tokens endpoint uses short chain slugs (e.g. "solana") while the
// SDK identifies networks with qualified names (e.g. "solana-mainnet").
const NETWORK_SLUG: Readonly<Record<string, string>> = {
  "solana-mainnet": "solana",
  "solana-devnet": "solana-devnet",
};

const tokenInfoResponseEntryCodec = Codec.interface({
  descriptor: Codec.interface({
    data: string,
    signatures: calSignaturesCodec,
  }),
});

@injectable()
export class HttpTokenInfoDataSource implements TokenInfoDataSource {
  constructor(
    @inject(configTypes.Config)
    private readonly config: ContextModuleServiceConfig,
    @inject(networkTypes.NetworkClient)
    private readonly http: DmkNetworkClient,
  ) {}

  public async getTokenInfo({
    mint,
    network,
  }: GetTokenInfoParams): Promise<Either<Error, TokenInfoResult>> {
    let data: unknown;
    try {
      data = await this.http.get(`${this.config.cal.url}/tokens`, {
        params: {
          contract_address: mint,
          network: NETWORK_SLUG[network] ?? network,
          output: "contract_address,network,descriptor",
          ref: `branch:${this.config.cal.branch}`,
        },
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return Left(
        new Error(
          `[ContextModule] HttpTokenInfoDataSource: Failed to fetch token info: ${reason}`,
        ),
      );
    }

    if (!Array.isArray(data) || data.length === 0) {
      return Left(
        new Error(
          `[ContextModule] HttpTokenInfoDataSource: no token info for mint ${mint}`,
        ),
      );
    }

    return tokenInfoResponseEntryCodec
      .decode(data[0])
      .caseOf<Either<Error, TokenInfoResult>>({
        Left: (error) =>
          Left(
            new Error(
              `[ContextModule] HttpTokenInfoDataSource: malformed descriptor for mint ${mint}: ${error}`,
            ),
          ),
        Right: (entry) =>
          Right({
            mint,
            descriptor: entry.descriptor,
          }),
      });
  }
}
