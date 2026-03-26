import { ContainerModule } from "inversify";

import { type ResolvedContextModuleConfig } from "@/config/model/ContextModuleConfig";

import { configTypes } from "./configTypes";

export const configModuleFactory = (config: ResolvedContextModuleConfig) =>
  new ContainerModule(({ bind }) => {
    bind<ResolvedContextModuleConfig>(configTypes.Config).toConstantValue(
      config,
    );
  });
