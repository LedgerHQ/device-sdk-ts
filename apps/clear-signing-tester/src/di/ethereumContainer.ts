import { Container } from "inversify";

import { type LoggerConfig } from "@root/src/domain/models/config/LoggerConfig";

import {
  type ClearSigningTesterConfig,
  configModuleFactory,
} from "./modules/configModuleFactory";
import { ethereumApplicationModuleFactory } from "./modules/ethereumApplicationModuleFactory";
import { ethereumInfrastructureModuleFactory } from "./modules/ethereumInfrastructureModuleFactory";
import { loggerModuleFactory } from "./modules/loggerModuleFactory";
import { sharedInfrastructureModuleFactory } from "./modules/sharedInfrastructureModuleFactory";

type MakeEthereumContainerArgs = {
  config: ClearSigningTesterConfig;
  logger: LoggerConfig;
};

export const makeEthereumContainer = ({
  config,
  logger,
}: MakeEthereumContainerArgs): Container => {
  const container = new Container();

  container.loadSync(
    configModuleFactory(config),
    sharedInfrastructureModuleFactory(config),
    ethereumInfrastructureModuleFactory(config),
    ethereumApplicationModuleFactory(),
    loggerModuleFactory({ config: logger }),
  );

  return container;
};
