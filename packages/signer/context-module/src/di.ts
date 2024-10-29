import { Container } from "inversify";

import { configModuleFactory } from "@/config/di/configModuleFactory";
import { type ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import { externalPluginModuleFactory } from "@/external-plugin/di/externalPluginModuleFactory";
import { forwardDomainModuleFactory } from "@/forward-domain/di/forwardDomainModuleFactory";
import { nftModuleFactory } from "@/nft/di/nftModuleFactory";
import { tokenModuleFactory } from "@/token/di/tokenModuleFactory";
import { typedDataModuleFactory } from "@/typed-data/di/typedDataModuleFactory";

type MakeContainerArgs = {
  config: ContextModuleConfig;
};

export const makeContainer = ({ config }: MakeContainerArgs) => {
  const container = new Container();

  container.load(
    configModuleFactory(config),
    externalPluginModuleFactory(),
    forwardDomainModuleFactory(),
    nftModuleFactory(),
    tokenModuleFactory(),
    typedDataModuleFactory(),
  );

  return container;
};
