import { type Either } from "purify-ts/Either";

export type GetDomainNameInfosParams = {
  domain: string;
  challenge: string;
};

export type GetTrustedNameInfosParams = {
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
