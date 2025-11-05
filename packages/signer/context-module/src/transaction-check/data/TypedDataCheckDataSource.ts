import { type Either } from "purify-ts";

export type TypedData = {
  domain: {
    name?: string;
    version?: string;
    chainId?: number;
    verifyingContract?: string;
    salt?: string;
  };
  types: Record<string, Array<{ name: string; type: string }>>;
  primaryType: string;
  message: Record<string, unknown>;
};

export type GetTypedDataCheckParams = {
  from: string;
  data: TypedData;
};

export type TypedDataCheck = {
  publicKeyId: string;
  descriptor: string;
};

export interface TypedDataCheckDataSource {
  getTypedDataCheck(
    params: GetTypedDataCheckParams,
  ): Promise<Either<Error, TypedDataCheck>>;
}
