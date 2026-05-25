import { type Either } from "purify-ts";

export type GetAltResolutionParams = {
  altAddress: string;
  entryIndex: number;
  challenge: string;
};

export type AltResolutionResult = {
  altAddress: string;
  entryIndex: number;
  // Raw signed TLV bytes decoded from the backend response.
  descriptor: Uint8Array;
  keyId: string;
  keyUsage: string;
};

export interface AltResolutionDataSource {
  getAltResolution(
    params: GetAltResolutionParams,
  ): Promise<Either<Error, AltResolutionResult>>;
}
