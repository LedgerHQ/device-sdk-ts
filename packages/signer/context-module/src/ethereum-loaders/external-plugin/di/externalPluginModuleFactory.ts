import { ContainerModule } from "inversify";

import { HttpExternalPluginDataSource } from "@/ethereum-loaders/external-plugin/data/HttpExternalPluginDataSource";
import { ethereumExternalPluginTypes } from "@/ethereum-loaders/external-plugin/di/ethereumExternalPluginTypes";
import { ExternalPluginContextLoader } from "@/ethereum-loaders/external-plugin/domain/ExternalPluginContextLoader";

export const externalPluginModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(ethereumExternalPluginTypes.EthereumExternalPluginDataSource).to(
      HttpExternalPluginDataSource,
    );
    bind(ethereumExternalPluginTypes.EthereumExternalPluginContextLoader).to(
      ExternalPluginContextLoader,
    );
  });
