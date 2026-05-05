import { ContainerModule } from "inversify";

import { HttpExternalPluginDataSource } from "@/loaders/ethereum/external-plugin/data/HttpExternalPluginDataSource";
import { ethereumExternalPluginTypes } from "@/loaders/ethereum/external-plugin/di/ethereumExternalPluginTypes";
import { ExternalPluginContextLoader } from "@/loaders/ethereum/external-plugin/domain/ExternalPluginContextLoader";

export const externalPluginModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(ethereumExternalPluginTypes.EthereumExternalPluginDataSource).to(
      HttpExternalPluginDataSource,
    );
    bind(ethereumExternalPluginTypes.EthereumExternalPluginContextLoader).to(
      ExternalPluginContextLoader,
    );
  });
