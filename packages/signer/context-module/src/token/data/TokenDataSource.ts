import { Either } from "purify-ts";

export type GetTokenInfosParams = {
  address: string;
  chainId: number;
};

export interface TokenDataSource {
  getTokenInfosPayload(
    params: GetTokenInfosParams,
  ): Promise<Either<Error, string | undefined>>;
}
