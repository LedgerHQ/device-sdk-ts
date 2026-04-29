import { Container } from "inversify";

import { type LoggerConfig } from "@root/src/domain/models/config/LoggerConfig";

import {
  type ClearSigningTesterConfig,
  configModuleFactory,
} from "./modules/configModuleFactory";
import { loggerModuleFactory } from "./modules/loggerModuleFactory";
import { sharedInfrastructureModuleFactory } from "./modules/sharedInfrastructureModuleFactory";
import { solanaApplicationModuleFactory } from "./modules/solanaApplicationModuleFactory";
import { solanaInfrastructureModuleFactory } from "./modules/solanaInfrastructureModuleFactory";

type MakeSolanaContainerArgs = {
  config: ClearSigningTesterConfig;
  logger: LoggerConfig;
};

export const makeSolanaContainer = ({
  config,
  logger,
}: MakeSolanaContainerArgs): Container => {
  const container = new Container();

  container.loadSync(
    configModuleFactory(config),
    sharedInfrastructureModuleFactory(config),
    solanaInfrastructureModuleFactory(config),
    solanaApplicationModuleFactory(),
    loggerModuleFactory({ config: logger }),
  );

  return container;
};
