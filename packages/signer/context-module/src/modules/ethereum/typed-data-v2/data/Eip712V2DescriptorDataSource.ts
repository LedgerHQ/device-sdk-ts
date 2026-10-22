import { type DeviceModelId } from "@ledgerhq/device-management-kit";
import { type Either } from "purify-ts";

import { type ClearSignContextSuccess } from "@/shared/model/ClearSignContext";

export type GetEip712V2DescriptorsParams = {
  verifyingContract: string;
  chainId: number;
  primaryTypeHash: string;
  deviceModelId: DeviceModelId;
};

export interface Eip712V2DescriptorDataSource {
  getDescriptors(
    params: GetEip712V2DescriptorsParams,
  ): Promise<Either<Error, ClearSignContextSuccess[]>>;
}
