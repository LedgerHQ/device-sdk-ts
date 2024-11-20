import axios from "axios";
import { inject, injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import type { ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import {
  GetDomainNameInfosParams,
  GetTrustedNameInfosParams,
  TrustedNameDataSource,
} from "@/trusted-name/data/TrustedNameDataSource";
import PACKAGE from "@root/package.json";

import { TrustedNameDto } from "./TrustedNameDto";

@injectable()
export class HttpTrustedNameDataSource implements TrustedNameDataSource {
  constructor(
    @inject(configTypes.Config) private readonly config: ContextModuleConfig,
  ) {}

  public async getDomainNamePayload({
    domain,
    challenge,
  }: GetDomainNameInfosParams): Promise<Either<Error, string>> {
    try {
      const type = "eoa"; // Externally owned account
      const source = "ens"; // Ethereum name service
      const response = await axios.request<TrustedNameDto>({
        method: "GET",
        url: `https://nft.api.live.ledger.com/v2/names/ethereum/1/forward/${domain}?types=${type}&sources=${source}&challenge=${challenge}`,
        headers: {
          "X-Ledger-Client-Version": `context-module/${PACKAGE.version}`,
        },
      });

      return response.data.signedDescriptor?.data
        ? Right(response.data.signedDescriptor.data)
        : Left(
            new Error(
              "[ContextModule] HttpTrustedNameDataSource: error getting domain payload",
            ),
          );
    } catch (_error) {
      return Left(
        new Error(
          "[ContextModule] HttpTrustedNameDataSource: Failed to fetch domain name",
        ),
      );
    }
  }

  public async getTrustedNamePayload({
    address,
    challenge,
    sources,
    types,
  }: GetTrustedNameInfosParams): Promise<Either<Error, string>> {
    try {
      const response = await axios.request<TrustedNameDto>({
        method: "GET",
        url: `https://nft.api.live.ledger.com/v2/names/ethereum/1/reverse/${address}?types=${types.join(",")}&sources=${sources.join(",")}&challenge=${challenge}`,
        headers: {
          "X-Ledger-Client-Version": `context-module/${PACKAGE.version}`,
        },
      });
      const trustedName = response.data;

      if (
        !trustedName ||
        !trustedName.signedDescriptor ||
        !trustedName.signedDescriptor.data ||
        !trustedName.signedDescriptor.signatures ||
        typeof trustedName.signedDescriptor.signatures[this.config.cal.mode] !==
          "string"
      ) {
        return Left(
          new Error(
            `[ContextModule] HttpTrustedNameDataSource: no trusted name metadata for address ${address}`,
          ),
        );
      }

      return Right(
        [
          trustedName.signedDescriptor.data,
          trustedName.signedDescriptor.signatures[this.config.cal.mode],
        ].join(""),
      );
    } catch (_error) {
      return Left(
        new Error(
          "[ContextModule] HttpTrustedNameDataSource: Failed to fetch trusted name",
        ),
      );
    }
  }
}
