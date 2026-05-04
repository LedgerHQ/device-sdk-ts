import { ContainerModule } from "inversify";

import { HttpTypedDataDataSource } from "@/ethereum-loaders/typed-data/data/HttpTypedDataDataSource";
import { ethereumTypedDataTypes } from "@/ethereum-loaders/typed-data/di/ethereumTypedDataTypes";
import { DefaultTypedDataContextLoader } from "@/ethereum-loaders/typed-data/domain/DefaultTypedDataContextLoader";

export const typedDataModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(ethereumTypedDataTypes.EthereumTypedDataDataSource).to(
      HttpTypedDataDataSource,
    );
    bind(ethereumTypedDataTypes.EthereumTypedDataContextLoader).to(
      DefaultTypedDataContextLoader,
    );
  });
