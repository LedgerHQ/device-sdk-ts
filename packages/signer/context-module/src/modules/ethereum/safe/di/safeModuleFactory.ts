import { ContainerModule } from "inversify";

import { HttpSafeAccountDataSource } from "@/modules/ethereum/safe/data/HttpSafeAccountDataSource";
import { SafeAddressLoader } from "@/modules/ethereum/safe/domain/SafeAddressLoader";

import { safeTypes } from "./safeTypes";

export const safeModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(safeTypes.SafeAddressDataSource).to(HttpSafeAccountDataSource);
    bind(safeTypes.SafeAddressLoader).to(SafeAddressLoader);
  });
