import { ContainerModule } from "inversify";

import { HttpExternalPluginDataSource } from "@/external-plugin/data/HttpExternalPluginDataSource";
import { externalPluginTypes } from "@/external-plugin/di/externalPluginTypes";

export const externalPluginModuleFactory = () =>
  new ContainerModule((bind, _unbind, _isBound, _rebind) => {
    bind(externalPluginTypes.ExternalPluginDataSource).to(
      HttpExternalPluginDataSource,
    );
  });
