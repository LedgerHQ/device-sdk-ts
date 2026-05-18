import { type HexaString } from "@ledgerhq/device-management-kit";
import { type Either } from "purify-ts";

export type GetSafeAccountParams = {
  safeContractAddress: HexaString;
  chainId: number;
  challenge: string;
};

export type SafeDescriptor = {
  signedDescriptor: string;
  keyId: string;
  keyUsage: string;
};

export type GetSafeAccountResponse = {
  account: SafeDescriptor;
  signers: SafeDescriptor;
};

export interface SafeAccountDataSource {
  getDescriptors(
    params: GetSafeAccountParams,
  ): Promise<Either<Error, GetSafeAccountResponse>>;
}
