import { ContainerModule } from "inversify";

import { HttpTypedDataDataSource } from "@/typed-data/data/HttpTypedDataDataSource";
import { typedDataTypes } from "@/typed-data/di/typedDataTypes";
import { DefaultTypedDataContextLoader } from "@/typed-data/domain/DefaultTypedDataContextLoader";

export const typedDataModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(typedDataTypes.TypedDataDataSource).to(HttpTypedDataDataSource);
    bind(typedDataTypes.TypedDataContextLoader).to(
      DefaultTypedDataContextLoader,
    );
  });
