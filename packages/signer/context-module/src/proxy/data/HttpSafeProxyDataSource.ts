import axios from "axios";
import { inject, injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import { type ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import {
  LEDGER_CLIENT_VERSION_HEADER,
  LEDGER_ORIGIN_TOKEN_HEADER,
} from "@/shared/constant/HttpHeaders";
import PACKAGE from "@root/package.json";

import { SafeProxyImplementationAddressDto } from "./dto/SafeProxyImplementationAddressDto";
import {
  GetProxyImplementationAddressParam,
  type ProxyDataSource,
  ProxyImplementationAddress,
} from "./ProxyDataSource";

@injectable()
export class HttpSafeProxyDataSource implements ProxyDataSource {
  constructor(
    @inject(configTypes.Config) private readonly config: ContextModuleConfig,
  ) {}

  async getProxyImplementationAddress({
    proxyAddress,
    chainId,
    challenge,
  }: GetProxyImplementationAddressParam): Promise<
    Either<Error, ProxyImplementationAddress>
  > {
    let dto: SafeProxyImplementationAddressDto | undefined;
    try {
      const response = await axios.request<SafeProxyImplementationAddressDto>({
        method: "GET",
        url: `${this.config.metadataServiceDomain.url}/v3/ethereum/${chainId}/contract/proxy/${proxyAddress}`,
        headers: {
          [LEDGER_CLIENT_VERSION_HEADER]: `context-module/${PACKAGE.version}`,
          [LEDGER_ORIGIN_TOKEN_HEADER]: this.config.originToken,
        },
        params: {
          challenge,
          resolver: "SAFE_GATEWAY",
        },
      });
      dto = response.data;
    } catch (_error) {
      return Left(
        new Error(
          `[ContextModule] HttpSafeProxyDataSource: Failed to fetch safe proxy implementation`,
        ),
      );
    }

    if (!dto) {
      return Left(
        new Error(
          `[ContextModule] HttpSafeProxyDataSource: No data received for proxy ${proxyAddress} on chain ${chainId}`,
        ),
      );
    }

    if (!this.isSafeProxyImplementationAddressDto(dto)) {
      return Left(
        new Error(
          `[ContextModule] HttpSafeProxyDataSource: Invalid safe proxy response format for proxy ${proxyAddress} on chain ${chainId}`,
        ),
      );
    }

    return Right({
      implementationAddress: dto.implementationAddress,
      signedDescriptor: dto.signedDescriptor,
      keyId: dto.keyId,
      keyUsage: dto.keyUsage,
    });
  }

  /**
   * Type guard to validate SafeProxyImplementationAddressDto
   */
  private isSafeProxyImplementationAddressDto(
    value: unknown,
  ): value is SafeProxyImplementationAddressDto {
    return (
      typeof value === "object" &&
      value !== null &&
      "proxyAddress" in value &&
      "implementationAddress" in value &&
      "standard" in value &&
      "signedDescriptor" in value &&
      "providedBy" in value &&
      "keyId" in value &&
      "keyUsage" in value &&
      typeof value.proxyAddress === "string" &&
      typeof value.implementationAddress === "string" &&
      typeof value.standard === "string" &&
      typeof value.signedDescriptor === "string" &&
      typeof value.providedBy === "string" &&
      typeof value.keyId === "string" &&
      typeof value.keyUsage === "string"
    );
  }
}
