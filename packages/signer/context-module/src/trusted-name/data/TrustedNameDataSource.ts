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

export interface TrustedNameDataSource {
  getDomainNamePayload(
    params: GetDomainNameInfosParams,
  ): Promise<Either<Error, string>>;

  getTrustedNamePayload(
    params: GetTrustedNameInfosParams,
  ): Promise<Either<Error, string>>;
}
