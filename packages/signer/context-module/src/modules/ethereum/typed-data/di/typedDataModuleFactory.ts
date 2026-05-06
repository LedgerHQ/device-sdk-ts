import { ContainerModule } from "inversify";

import { HttpTypedDataDataSource } from "@/modules/ethereum/typed-data/data/HttpTypedDataDataSource";
import { ethereumTypedDataTypes } from "@/modules/ethereum/typed-data/di/ethereumTypedDataTypes";
import { DefaultTypedDataContextLoader } from "@/modules/ethereum/typed-data/domain/DefaultTypedDataContextLoader";

export const typedDataModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(ethereumTypedDataTypes.EthereumTypedDataDataSource).to(
      HttpTypedDataDataSource,
    );
    bind(ethereumTypedDataTypes.EthereumTypedDataContextLoader).to(
      DefaultTypedDataContextLoader,
    );
  });
