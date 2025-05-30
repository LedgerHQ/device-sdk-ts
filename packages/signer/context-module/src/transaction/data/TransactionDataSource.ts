import {
  type DeviceModelId,
  type HexaString,
} from "@ledgerhq/device-management-kit";
import { type Either } from "purify-ts";

import { type ClearSignContextSuccess } from "@/shared/model/ClearSignContext";

export type GetTransactionDescriptorsParams = {
  address: string;
  chainId: number;
  selector: HexaString;
  deviceModelId: DeviceModelId;
};

export interface TransactionDataSource {
  getTransactionDescriptors(
    params: GetTransactionDescriptorsParams,
  ): Promise<Either<Error, ClearSignContextSuccess[]>>;
}
