import { ContainerModule } from "inversify";

import { HttpExternalPluginDataSource } from "@/modules/ethereum/external-plugin/data/HttpExternalPluginDataSource";
import { externalPluginTypes } from "@/modules/ethereum/external-plugin/di/externalPluginTypes";
import { ExternalPluginContextLoader } from "@/modules/ethereum/external-plugin/domain/ExternalPluginContextLoader";

export const externalPluginModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(externalPluginTypes.ExternalPluginDataSource).to(
      HttpExternalPluginDataSource,
    );
    bind(externalPluginTypes.ExternalPluginContextLoader).to(
      ExternalPluginContextLoader,
    );
  });
