import axios from "axios";
import { inject, injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import type { ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import { LEDGER_CLIENT_VERSION_HEADER } from "@/shared/constant/HttpHeaders";
import PACKAGE from "@root/package.json";

import { GetTokenInfosParams, TokenDataSource } from "./TokenDataSource";
import { TokenDto } from "./TokenDto";

@injectable()
export class HttpTokenDataSource implements TokenDataSource {
  constructor(
    @inject(configTypes.Config) private readonly config: ContextModuleConfig,
  ) {}
  public async getTokenInfosPayload({
    chainId,
    address,
  }: GetTokenInfosParams): Promise<Either<Error, string>> {
    try {
      const response = await axios.request<TokenDto[]>({
        method: "GET",
        url: `${this.config.cal.url}/tokens`,
        params: {
          contract_address: address,
          chain_id: chainId,
          output: "descriptor",
          ref: `branch:${this.config.cal.branch}`,
        },
        headers: {
          [LEDGER_CLIENT_VERSION_HEADER]: `context-module/${PACKAGE.version}`,
        },
      });
      const tokenInfos = response.data?.[0];

      if (
        !tokenInfos ||
        !tokenInfos.descriptor ||
        !tokenInfos.descriptor.data ||
        !tokenInfos.descriptor.signatures ||
        typeof tokenInfos.descriptor.signatures[this.config.cal.mode] !==
          "string"
      ) {
        return Left(
          new Error(
            `[ContextModule] HttpTokenDataSource: no token metadata for address ${address} on chain ${chainId}`,
          ),
        );
      }

      // According to documentation: https://github.com/LedgerHQ/app-ethereum/blob/develop/doc/ethapp.adoc#provide-erc-20-token-information
      // Signed descriptor is composed of:
      // ticker || address (20 bytes) || number of decimals (4 bytes) || chainId (4 bytes)
      const tickerLengthBuff = (
        tokenInfos.descriptor.data.length / 2 -
        20 -
        4 -
        4
      )
        .toString(16)
        .padStart(2, "0");

      return Right(
        [
          tickerLengthBuff,
          tokenInfos.descriptor.data,
          tokenInfos.descriptor.signatures[this.config.cal.mode],
        ].join(""),
      );
    } catch (_error) {
      return Left(
        new Error(
          "[ContextModule] HttpTokenDataSource: Failed to fetch token informations",
        ),
      );
    }
  }
}
