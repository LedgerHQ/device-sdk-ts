import { Container } from "inversify";

import { externalPluginModuleFactory } from "@/external-plugin/di/externalPluginModuleFactory";
import { forwardDomainModuleFactory } from "@/forward-domain/di/forwardDomainModuleFactory";
import { nftModuleFactory } from "@/nft/di/nftModuleFactory";
import { tokenModuleFactory } from "@/token/di/tokenModuleFactory";

export const makeContainer = () => {
  const container = new Container();

  container.load(
    externalPluginModuleFactory(),
    forwardDomainModuleFactory(),
    nftModuleFactory(),
    tokenModuleFactory(),
  );

  return container;
};
