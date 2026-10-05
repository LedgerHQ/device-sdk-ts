import { ContainerModule } from "inversify";

import { HttpTypedDataDataSource } from "@/modules/ethereum/typed-data/data/HttpTypedDataDataSource";
import { HttpTypedDataDescriptorDataSource } from "@/modules/ethereum/typed-data/data/HttpTypedDataDescriptorDataSource";
import { typedDataTypes } from "@/modules/ethereum/typed-data/di/typedDataTypes";
import { DefaultTypedDataContextLoader } from "@/modules/ethereum/typed-data/domain/DefaultTypedDataContextLoader";

export const typedDataModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(typedDataTypes.TypedDataDataSource).to(HttpTypedDataDataSource);
    bind(typedDataTypes.TypedDataDescriptorDataSource).to(
      HttpTypedDataDescriptorDataSource,
    );
    bind(typedDataTypes.TypedDataContextLoader).to(
      DefaultTypedDataContextLoader,
    );
  });
