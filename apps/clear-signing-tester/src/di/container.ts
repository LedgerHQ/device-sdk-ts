import { Container } from "inversify";

import { type LoggerConfig } from "@root/src/domain/models/config/LoggerConfig";

import { applicationModuleFactory } from "./modules/applicationModuleFactory";
import {
  type ClearSigningTesterConfig,
  configModuleFactory,
} from "./modules/configModuleFactory";
import { infrastructureModuleFactory } from "./modules/infrastructureModuleFactory";
import { loggerModuleFactory } from "./modules/loggerModuleFactory";

type MakeContainerArgs = {
  config: ClearSigningTesterConfig;
  logger: LoggerConfig;
};

export const makeContainer = ({
  config,
  logger,
}: MakeContainerArgs): Container => {
  const container = new Container();

  container.loadSync(
    configModuleFactory(config),
    infrastructureModuleFactory(config),
    applicationModuleFactory(),
    loggerModuleFactory({ config: logger }),
  );

  return container;
};
