import { type Either } from "purify-ts";

export type GetSolanaTrustedNameParams = {
  address: string;
  network: string;
  challenge: string;
  sources: string[];
};

export type SolanaTrustedNameResult = {
  address: string;
  // Raw signed TLV bytes decoded from the backend response.
  descriptor: Uint8Array;
  keyId: string;
  keyUsage: string;
};

export interface SolanaTrustedNameDataSource {
  getTrustedName(
    params: GetSolanaTrustedNameParams,
  ): Promise<Either<Error, SolanaTrustedNameResult>>;
}
