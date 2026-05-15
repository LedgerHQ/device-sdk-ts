import { type Either } from "purify-ts";

export type GetAleoTokenInfosParams = {
  tokenInternalId: string;
  programName?: string;
};

export type AleoTokenDataResponse = {
  descriptor: {
    data: string;
    signatures: {
      prod: string;
      test: string;
    };
  };
};

export interface AleoTokenDataSource {
  getTokenInfosPayload(
    params: GetAleoTokenInfosParams,
  ): Promise<Either<Error, AleoTokenDataResponse>>;
}
