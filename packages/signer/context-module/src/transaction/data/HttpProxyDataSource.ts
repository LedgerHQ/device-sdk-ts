import axios from "axios";
import { inject, injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import { type ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import { LEDGER_CLIENT_VERSION_HEADER } from "@/shared/constant/HttpHeaders";
import { type ProxyDelegateCall } from "@/transaction/model/ProxyDelegateCall";
import { type ProxyImplementationAddress } from "@/transaction/model/ProxyImplementationAddress";
import PACKAGE from "@root/package.json";

import { type ProxyDelegateCallDto } from "./ProxyDelegateCallDto";
import { type ProxyImplementationAddressDto } from "./ProxyImplementationAddressDto";

export type GetProxyDelegateCallParam = {
  proxyAddress: string;
  calldata: string;
  chainId: number;
};

export type GetProxyImplementationAddressParam = {
  proxyAddress: string;
  chainId: number;
};

export interface ProxyDataSource {
  getProxyDelegateCall(
    params: GetProxyDelegateCallParam,
  ): Promise<Either<Error, ProxyDelegateCall>>;
  getProxyImplementationAddress(
    params: GetProxyImplementationAddressParam,
  ): Promise<Either<Error, ProxyImplementationAddress>>;
}

@injectable()
export class HttpProxyDataSource implements ProxyDataSource {
  constructor(
    @inject(configTypes.Config) private readonly config: ContextModuleConfig,
  ) {}

  public async getProxyDelegateCall({
    proxyAddress,
    calldata,
    chainId,
  }: GetProxyDelegateCallParam): Promise<Either<Error, ProxyDelegateCall>> {
    let dto: ProxyDelegateCallDto | undefined;
    try {
      const response = await axios.request<ProxyDelegateCallDto>({
        method: "POST",
        url: `${this.config.metadataService.url}/ethereum/${chainId}/contract/proxy/delegate`,
        headers: {
          [LEDGER_CLIENT_VERSION_HEADER]: `context-module/${PACKAGE.version}`,
        },
        data: {
          proxy: proxyAddress,
          data: calldata,
        },
      });
      dto = response.data;
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

    return Right(dto as ProxyDelegateCall);
  }

  public async getProxyImplementationAddress({
    proxyAddress,
    chainId,
  }: GetProxyImplementationAddressParam): Promise<
    Either<Error, ProxyImplementationAddress>
  > {
    let dto: ProxyImplementationAddressDto | undefined;
    try {
      const response = await axios.request<ProxyImplementationAddressDto>({
        method: "GET",
        url: `${this.config.metadataService.url}/ethereum/${chainId}/contract/proxy/${proxyAddress}`,
        headers: {
          [LEDGER_CLIENT_VERSION_HEADER]: `context-module/${PACKAGE.version}`,
        },
      });
      dto = response.data;
    } catch (_error) {
      return Left(
        new Error(
          `[ContextModule] HttpProxyDataSource: Failed to fetch implementation address`,
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

    if (!this.isProxyImplementationAddressDto(dto)) {
      return Left(
        new Error(
          `[ContextModule] HttpProxyDataSource: Invalid proxy implementation address response format for proxy ${proxyAddress} on chain ${chainId}`,
        ),
      );
    }

    return Right({ implementationAddress: dto.implementationAddress });
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
      "delegateAddresses" in value &&
      "signedDescriptor" in value &&
      Array.isArray(value.delegateAddresses) &&
      value.delegateAddresses.every((address) => typeof address === "string") &&
      typeof value.signedDescriptor === "string"
    );
  }

  /**
   * Type guard to validate ProxyImplementationAddressDto
   */
  private isProxyImplementationAddressDto(
    value: unknown,
  ): value is ProxyImplementationAddressDto {
    return (
      typeof value === "object" &&
      value !== null &&
      "proxyAddress" in value &&
      "implementationAddress" in value &&
      "standard" in value &&
      typeof value.proxyAddress === "string" &&
      typeof value.implementationAddress === "string" &&
      typeof value.standard === "string" &&
      value.standard.length > 0
    );
  }
}
