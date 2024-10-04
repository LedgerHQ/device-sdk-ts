import { ContainerModule } from "inversify";

import { ContextModuleConfig } from "@/config/model/ContextModuleConfig";

import { configTypes } from "./configTypes";

export const configModuleFactory = (config: ContextModuleConfig) =>
  new ContainerModule((bind, _unbind, _isBound, _rebind) => {
    bind<ContextModuleConfig>(configTypes.Config).toConstantValue(config);
  });
