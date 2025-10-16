import { ContainerModule } from "inversify";

import { HttpSafeAccountDataSource } from "@/safe/data/HttpSafeAccountDataSource";
import { SafeAddressLoader } from "@/safe/domain/SafeAddressLoader";

import { safeTypes } from "./safeTypes";

export const safeModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(safeTypes.SafeAddressDataSource).to(HttpSafeAccountDataSource);
    bind(safeTypes.SafeAddressLoader).to(SafeAddressLoader);
  });
