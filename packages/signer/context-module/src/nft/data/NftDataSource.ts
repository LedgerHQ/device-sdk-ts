import { type Either } from "purify-ts";

export type GetSetPluginPayloadParams = {
  chainId: number;
  address: string;
  selector: string;
};

export type GetNftInformationsParams = {
  chainId: number;
  address: string;
};

export interface NftDataSource {
  getNftInfosPayload(
    params: GetNftInformationsParams,
  ): Promise<Either<Error, string>>;
  getSetPluginPayload(
    params: GetSetPluginPayloadParams,
  ): Promise<Either<Error, string>>;
}
