import { Either } from "purify-ts";

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
  ): Promise<Either<Error, string | undefined>>;
  getSetPluginPayload(
    params: GetSetPluginPayloadParams,
  ): Promise<Either<Error, string | undefined>>;
}
