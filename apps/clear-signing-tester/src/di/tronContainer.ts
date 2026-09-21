import { Container } from "inversify";

import { type LoggerConfig } from "@root/src/domain/models/config/LoggerConfig";

import {
  type ClearSigningTesterConfig,
  configModuleFactory,
} from "./modules/configModuleFactory";
import { loggerModuleFactory } from "./modules/loggerModuleFactory";
import { sharedInfrastructureModuleFactory } from "./modules/sharedInfrastructureModuleFactory";
import { tronApplicationModuleFactory } from "./modules/tronApplicationModuleFactory";
import { tronInfrastructureModuleFactory } from "./modules/tronInfrastructureModuleFactory";

type MakeTronContainerArgs = {
  config: ClearSigningTesterConfig;
  logger: LoggerConfig;
};

export const makeTronContainer = ({
  config,
  logger,
}: MakeTronContainerArgs): Container => {
  const container = new Container();

  container.loadSync(
    configModuleFactory(config),
    sharedInfrastructureModuleFactory(config),
    tronInfrastructureModuleFactory(config),
    tronApplicationModuleFactory(),
    loggerModuleFactory({ config: logger }),
  );

  return container;
};
