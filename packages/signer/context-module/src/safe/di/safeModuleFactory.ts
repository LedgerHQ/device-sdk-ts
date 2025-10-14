import { ContainerModule } from "inversify";

import { HttpSafeAccountDataSource } from "@/safe/data/HttpSafeAccountDataSource";
import { SafeAccountLoader } from "@/safe/domain/SafeAccountLoader";

import { safeTypes } from "./safeTypes";

export const safeModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(safeTypes.SafeAccountDataSource).to(HttpSafeAccountDataSource);
    bind(safeTypes.SafeAccountLoader).to(SafeAccountLoader);
  });
