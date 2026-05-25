import { type Either } from "purify-ts";

export type GetTokenInfoParams = {
  mint: string;
  network: string;
};

export type TokenInfoResult = {
  mint: string;
  descriptor: {
    data: string;
    signatures: { prod?: string; test?: string };
  };
};

/**
 * Resolves the CAL `TOKEN_INFO` descriptor for a given Solana mint pubkey.
 * The lookup key is the on-chain mint pubkey, rather than the legacy CAL
 * internal token id consumed by the existing {@link TokenContextLoader}.
 */
export interface TokenInfoDataSource {
  getTokenInfo(
    params: GetTokenInfoParams,
  ): Promise<Either<Error, TokenInfoResult>>;
}
