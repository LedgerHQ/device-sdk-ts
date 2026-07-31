import { type Either } from "purify-ts";

export type GetIdFromMintParams = {
  mintAddress: string;
};

export interface MintToIdDataSource {
  getIdFromMint(params: GetIdFromMintParams): Promise<Either<Error, string>>;
}
