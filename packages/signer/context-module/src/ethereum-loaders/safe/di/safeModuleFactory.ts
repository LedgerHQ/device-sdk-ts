import { ContainerModule } from "inversify";

import { HttpSafeAccountDataSource } from "@/ethereum-loaders/safe/data/HttpSafeAccountDataSource";
import { SafeAddressLoader } from "@/ethereum-loaders/safe/domain/SafeAddressLoader";

import { ethereumSafeTypes } from "./ethereumSafeTypes";

export const safeModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(ethereumSafeTypes.EthereumSafeAddressDataSource).to(
      HttpSafeAccountDataSource,
    );
    bind(ethereumSafeTypes.EthereumSafeAddressLoader).to(SafeAddressLoader);
  });
