import axios from "axios";
import { inject, injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import type { ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import { HexStringUtils } from "@/shared/utils/HexStringUtils";
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
          output: "live_signature,ticker,decimals",
        },
        headers: {
          "X-Ledger-Client-Version": `context-module/${PACKAGE.version}`,
        },
      });
      const tokenInfos = response.data?.[0];

      if (
        !tokenInfos ||
        !tokenInfos.live_signature ||
        !tokenInfos.ticker ||
        !tokenInfos.decimals
      ) {
        return Left(
          new Error(
            `[ContextModule] HttpTokenDataSource: no token metadata for address ${address} on chain ${chainId}`,
          ),
        );
      }

      // 1 byte for the length of the ticker
      const tickerLengthBuff = tokenInfos.ticker.length
        .toString(16)
        .padStart(2, "0");

      // ticker ascii
      const tickerBuff = HexStringUtils.stringToHex(tokenInfos.ticker);

      // bufferized address
      const addressBuff = address.slice(2);

      // 4 bytes for the decimals
      const decimalsBuff = tokenInfos.decimals.toString(16).padStart(8, "0");

      // 4 bytes for the chainId
      const chainIdBuff = chainId.toString(16).padStart(8, "0");

      return Right(
        [
          tickerLengthBuff,
          tickerBuff,
          addressBuff,
          decimalsBuff,
          chainIdBuff,
          tokenInfos.live_signature,
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
