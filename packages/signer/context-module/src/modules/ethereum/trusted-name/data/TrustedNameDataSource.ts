import { type Either } from "purify-ts/Either";

export type GetDomainNameInfosParams = {
  chainId: number;
  domain: string;
  challenge: string;
};

export type GetTrustedNameInfosParams = {
  chainId: number;
  address: string;
  challenge: string;
  types: string[];
  sources: string[];
};

export type TrustedNamePayload = {
  data: string;
  keyId: string;
  keyUsage: string;
};

export interface TrustedNameDataSource {
  getDomainNamePayload(
    params: GetDomainNameInfosParams,
  ): Promise<Either<Error, TrustedNamePayload>>;

  getTrustedNamePayload(
    params: GetTrustedNameInfosParams,
  ): Promise<Either<Error, TrustedNamePayload>>;
}
