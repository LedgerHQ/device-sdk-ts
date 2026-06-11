import { type Either } from "purify-ts";

export type GetTokenAccountStateParams = {
  tokenAccount: string;
  challenge: string;
};

export type TokenAccountStateResult = {
  tokenAccount: string;
  // Raw signed TLV bytes decoded from the backend response.
  descriptor: Uint8Array;
  keyId: string;
  keyUsage: string;
};

export interface TokenAccountStateDataSource {
  getTokenAccountState(
    params: GetTokenAccountStateParams,
  ): Promise<Either<Error, TokenAccountStateResult>>;
}
