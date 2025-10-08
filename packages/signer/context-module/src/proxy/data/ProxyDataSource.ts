import { type Either } from "purify-ts";

export type GetProxyImplementationAddressParam = {
  proxyAddress: string;
  chainId: number;
  challenge: string;
  calldata: string;
};

export type ProxyImplementationAddress = {
  implementationAddress: string;
  signedDescriptor: string;
  keyId: string;
  keyUsage: string;
};

export interface ProxyDataSource {
  getProxyImplementationAddress(
    params: GetProxyImplementationAddressParam,
  ): Promise<Either<Error, ProxyImplementationAddress>>;
}
