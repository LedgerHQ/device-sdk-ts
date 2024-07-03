import { Either } from "purify-ts/Either";

export type GetForwardDomainInfosParams = {
  domain: string;
  challenge: string;
};

export interface ForwardDomainDataSource {
  getDomainNamePayload(
    params: GetForwardDomainInfosParams,
  ): Promise<Either<Error, string>>;
}
