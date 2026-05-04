import { type HexaString } from "@ledgerhq/device-management-kit";
import { type Either } from "purify-ts";

export type GetGatedDescriptorParams = {
  contractAddress: HexaString;
  selector: HexaString;
  chainId: number;
};

export type GetGatedDescriptorForTypedDataParams = {
  contractAddress: HexaString;
  schemaHash: string;
  chainId: number;
};

export type GetGatedDescriptorResponse = {
  signedDescriptor: string;
};

export interface GatedDescriptorDataSource {
  getGatedDescriptor(
    params: GetGatedDescriptorParams,
  ): Promise<Either<Error, GetGatedDescriptorResponse>>;

  getGatedDescriptorForTypedData(
    params: GetGatedDescriptorForTypedDataParams,
  ): Promise<Either<Error, GetGatedDescriptorResponse>>;
}
