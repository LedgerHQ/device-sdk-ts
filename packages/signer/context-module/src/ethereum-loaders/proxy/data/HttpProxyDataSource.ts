import { DmkNetworkClient } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import { networkTypes } from "@/chain-agnostic-loaders/network/di/networkTypes";
import { KeyId } from "@/chain-agnostic-loaders/pki/model/KeyId";
import { KeyUsage } from "@/chain-agnostic-loaders/pki/model/KeyUsage";
import { configTypes } from "@/config/di/configTypes";
import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";

import { ProxyDelegateCallDto } from "./dto/ProxyDelegateCallDto";
import {
  GetProxyImplementationAddressParam,
  ProxyDataSource,
  ProxyImplementationAddress,
} from "./ProxyDataSource";

@injectable()
export class HttpProxyDataSource implements ProxyDataSource {
  constructor(
    @inject(configTypes.Config)
    private readonly config: ContextModuleServiceConfig,
    @inject(networkTypes.NetworkClient)
    private readonly http: DmkNetworkClient,
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
      dto = (await this.http.post(
        `${this.config.metadataServiceDomain.url}/v2/ethereum/${chainId}/contract/proxy/delegate`,
        {
          proxy: proxyAddress,
          data: calldata,
          challenge,
        },
      )) as ProxyDelegateCallDto;
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
