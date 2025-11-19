import { type LoggerSubscriberService } from "@ledgerhq/device-management-kit";
import { Container } from "inversify";

import { applicationModuleFactory } from "./modules/applicationModuleFactory";
import {
  type ClearSigningTesterConfig,
  configModuleFactory,
} from "./modules/configModuleFactory";
import { infrastructureModuleFactory } from "./modules/infrastructureModuleFactory";
import { loggerModuleFactory } from "./modules/loggerModuleFactory";

type MakeContainerArgs = {
  config: ClearSigningTesterConfig;
  loggers?: LoggerSubscriberService[];
};

export const makeContainer = ({
  config,
  loggers = [],
}: MakeContainerArgs): Container => {
  const container = new Container();

  container.loadSync(
    configModuleFactory(config),
    infrastructureModuleFactory(config),
    applicationModuleFactory(),
    loggerModuleFactory({ subscribers: loggers }),
  );

  return container;
};
