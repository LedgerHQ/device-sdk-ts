import { ContainerModule } from "inversify";

import { HttpExternalPluginDataSource } from "@/external-plugin/data/HttpExternalPluginDataSource";
import { externalPluginTypes } from "@/external-plugin/di/externalPluginTypes";
import { ExternalPluginContextLoader } from "@/external-plugin/domain/ExternalPluginContextLoader";

export const externalPluginModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(externalPluginTypes.ExternalPluginDataSource).to(
      HttpExternalPluginDataSource,
    );
    bind(externalPluginTypes.ExternalPluginContextLoader).to(
      ExternalPluginContextLoader,
    );
  });
