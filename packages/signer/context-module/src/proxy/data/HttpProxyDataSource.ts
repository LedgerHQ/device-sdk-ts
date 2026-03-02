import { inject, injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import { type ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import { KeyId } from "@/pki/model/KeyId";
import { KeyUsage } from "@/pki/model/KeyUsage";
import {
  LEDGER_CLIENT_VERSION_HEADER,
  LEDGER_ORIGIN_TOKEN_HEADER,
} from "@/shared/constant/HttpHeaders";
import PACKAGE from "@root/package.json";

import { ProxyDelegateCallDto } from "./dto/ProxyDelegateCallDto";
import {
  GetProxyImplementationAddressParam,
  ProxyDataSource,
  ProxyImplementationAddress,
} from "./ProxyDataSource";

@injectable()
export class HttpProxyDataSource implements ProxyDataSource {
  constructor(
    @inject(configTypes.Config) private readonly config: ContextModuleConfig,
  ) {}

  async getProxyImplementationAddress({
    proxyAddress,
    chainId,
    challenge,
    calldata,
  }: GetProxyImplementationAddressParam): Promise<
    Either<Error, ProxyImplementationAddress>
  > {
    let dto: ProxyDelegateCallDto | undefined;
    try {
      const response = await fetch(
        `${this.config.metadataServiceDomain.url}/v2/ethereum/${chainId}/contract/proxy/delegate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            [LEDGER_CLIENT_VERSION_HEADER]: `context-module/${PACKAGE.version}`,
            ...(this.config.originToken && {
              [LEDGER_ORIGIN_TOKEN_HEADER]: this.config.originToken,
            }),
          },
          body: JSON.stringify({
            proxy: proxyAddress,
            data: calldata,
            challenge,
          }),
        },
      );
      if (!response.ok) {
        throw new Error(`HTTP error ${response.status}`);
      }
      dto = (await response.json()) as ProxyDelegateCallDto;
    } catch (_error) {
      return Left(
        new Error(
          `[ContextModule] HttpProxyDataSource: Failed to fetch delegate proxy`,
        ),
      );
    }

    if (!dto) {
      return Left(
        new Error(
          `[ContextModule] HttpProxyDataSource: No data received for proxy ${proxyAddress} on chain ${chainId}`,
        ),
      );
    }

    if (!this.isProxyDelegateCallDto(dto)) {
      return Left(
        new Error(
          `[ContextModule] HttpProxyDataSource: Invalid proxy delegate call response format for proxy ${proxyAddress} on chain ${chainId}`,
        ),
      );
    }

    if (!dto.addresses[0]) {
      return Left(
        new Error(
          `[ContextModule] HttpProxyDataSource: No implementation address found for proxy ${proxyAddress} on chain ${chainId}`,
        ),
      );
    }

    return Right({
      implementationAddress: dto.addresses[0],
      signedDescriptor: dto.signedDescriptor,
      keyId: KeyId.DomainMetadataKey,
      keyUsage: KeyUsage.TrustedName,
    });
  }

  /**
   * Type guard to validate ProxyDelegateCallDto
   */
  private isProxyDelegateCallDto(
    value: unknown,
  ): value is ProxyDelegateCallDto {
    return (
      typeof value === "object" &&
      value !== null &&
      "addresses" in value &&
      "signedDescriptor" in value &&
      Array.isArray(value.addresses) &&
      value.addresses.every((address) => typeof address === "string") &&
      typeof value.signedDescriptor === "string"
    );
  }
}
