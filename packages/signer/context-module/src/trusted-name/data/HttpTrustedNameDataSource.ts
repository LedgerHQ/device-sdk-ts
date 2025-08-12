import axios from "axios";
import { inject, injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import type { ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import {
  LEDGER_CLIENT_VERSION_HEADER,
  LEDGER_ORIGIN_TOKEN_HEADER,
} from "@/shared/constant/HttpHeaders";
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
    chainId,
    domain,
    challenge,
  }: GetDomainNameInfosParams): Promise<Either<Error, string>> {
    try {
      const type = "eoa"; // Externally owned account
      const source = "ens"; // Ethereum name service
      const response = await axios.request<TrustedNameDto>({
        method: "GET",
        url: `${this.config.metadataService.url}/names/ethereum/${chainId}/forward/${domain}?types=${type}&sources=${source}&challenge=${challenge}`,
        headers: {
          [LEDGER_CLIENT_VERSION_HEADER]: `context-module/${PACKAGE.version}`,
          [LEDGER_ORIGIN_TOKEN_HEADER]: this.config.originToken,
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
    chainId,
    address,
    challenge,
    sources,
    types,
  }: GetTrustedNameInfosParams): Promise<Either<Error, string>> {
    try {
      // TODO remove that filtering once https://ledgerhq.atlassian.net/browse/BACK-8075 is done
      // For now we have to filter or trusted names won't work with the generic parser, because transaction
      // fields descriptors can contain unsupported sources.
      sources = sources.filter(
        (source) => source === "ens" || source === "crypto_asset_list",
      );
      const response = await axios.request<TrustedNameDto>({
        method: "GET",
        url: `${this.config.metadataService.url}/names/ethereum/${chainId}/reverse/${address}?types=${types.join(",")}&sources=${sources.join(",")}&challenge=${challenge}`,
        headers: {
          [LEDGER_CLIENT_VERSION_HEADER]: `context-module/${PACKAGE.version}`,
          [LEDGER_ORIGIN_TOKEN_HEADER]: this.config.originToken,
        },
      });
      const trustedName = response.data;
      if (!trustedName?.signedDescriptor?.data) {
        return Left(
          new Error(
            `[ContextModule] HttpTrustedNameDataSource: no trusted name metadata for address ${address}`,
          ),
        );
      }
      const payload = trustedName.signedDescriptor.data;

      if (
        !trustedName.signedDescriptor.signatures ||
        typeof trustedName.signedDescriptor.signatures[this.config.cal.mode] !==
          "string"
      ) {
        // If we have no separated signature but a valid descriptor, it may mean the descriptor was
        // signed on-the-fly for dynamic sources such as ens
        return Right(payload);
      }

      const signature =
        trustedName.signedDescriptor.signatures[this.config.cal.mode]!;
      return Right(this.formatTrustedName(payload, signature));
    } catch (_error) {
      return Left(
        new Error(
          "[ContextModule] HttpTrustedNameDataSource: Failed to fetch trusted name",
        ),
      );
    }
  }

  private formatTrustedName(payload: string, signature: string): string {
    // Ensure correct padding
    if (signature.length % 2 !== 0) {
      signature = "0" + signature;
    }
    // TLV encoding as according to trusted name documentation
    const signatureTag = "15";
    const signatureLength = (signature.length / 2).toString(16);
    return `${payload}${signatureTag}${signatureLength}${signature}`;
  }
}
