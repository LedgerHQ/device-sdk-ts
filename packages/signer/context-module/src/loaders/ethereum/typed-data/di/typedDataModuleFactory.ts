import { ContainerModule } from "inversify";

import { HttpTypedDataDataSource } from "@/loaders/ethereum/typed-data/data/HttpTypedDataDataSource";
import { ethereumTypedDataTypes } from "@/loaders/ethereum/typed-data/di/ethereumTypedDataTypes";
import { DefaultTypedDataContextLoader } from "@/loaders/ethereum/typed-data/domain/DefaultTypedDataContextLoader";

export const typedDataModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(ethereumTypedDataTypes.EthereumTypedDataDataSource).to(
      HttpTypedDataDataSource,
    );
    bind(ethereumTypedDataTypes.EthereumTypedDataContextLoader).to(
      DefaultTypedDataContextLoader,
    );
  });
