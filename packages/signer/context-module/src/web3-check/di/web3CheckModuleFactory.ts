import { ContainerModule } from "inversify";

import { HttpWeb3CheckDataSource } from "../datasource/HttpWeb3CheckDataSource";

export const web3CheckModuleFactory = () =>
  new ContainerModule((bind, _unbind, _isBound, _rebind) => {
    bind(typedDataTypes.TypedDataDataSource).to(HttpWeb3CheckDataSource);
    bind(typedDataTypes.TypedDataContextLoader).to(
      DefaultTypedDataContextLoader,
    );
  });
