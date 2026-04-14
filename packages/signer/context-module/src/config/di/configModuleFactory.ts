import { ContainerModule } from "inversify";

import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";

import { configTypes } from "./configTypes";

export const configModuleFactory = (config: ContextModuleServiceConfig) =>
  new ContainerModule(({ bind }) => {
    bind<ContextModuleServiceConfig>(configTypes.Config).toConstantValue(
      config,
    );
  });
