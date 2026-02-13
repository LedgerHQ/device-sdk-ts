import { type HexaString } from "@ledgerhq/device-management-kit";
import { type Either } from "purify-ts";

export type GetGatedDescriptorParams = {
  contractAddress: HexaString;
  selector: HexaString;
  chainId: number;
};

export type GetGatedDescriptorResponse = {
  signedDescriptor: string;
};

export interface GatedDescriptorDataSource {
  getGatedDescriptor(
    params: GetGatedDescriptorParams,
  ): Promise<Either<Error, GetGatedDescriptorResponse>>;
}
