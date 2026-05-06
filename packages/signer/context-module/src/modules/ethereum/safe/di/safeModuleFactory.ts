import { ContainerModule } from "inversify";

import { HttpSafeAccountDataSource } from "@/modules/ethereum/safe/data/HttpSafeAccountDataSource";
import { SafeAddressLoader } from "@/modules/ethereum/safe/domain/SafeAddressLoader";

import { ethereumSafeTypes } from "./ethereumSafeTypes";

export const safeModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(ethereumSafeTypes.EthereumSafeAddressDataSource).to(
      HttpSafeAccountDataSource,
    );
    bind(ethereumSafeTypes.EthereumSafeAddressLoader).to(SafeAddressLoader);
  });
