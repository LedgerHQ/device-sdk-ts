import {
  type BtcLegacyErrorCodes,
  type LegacyCoinProfile,
} from "@ledgerhq/device-signer-kit-bitcoin-legacy";
import { Container } from "inversify";

import { type LoggerConfig } from "@root/src/domain/models/config/LoggerConfig";

import { btcLegacyApplicationModuleFactory } from "./modules/btcLegacyApplicationModuleFactory";
import { btcLegacyInfrastructureModuleFactory } from "./modules/btcLegacyInfrastructureModuleFactory";
import {
  type ClearSigningTesterConfig,
  configModuleFactory,
} from "./modules/configModuleFactory";
import { loggerModuleFactory } from "./modules/loggerModuleFactory";
import { sharedInfrastructureModuleFactory } from "./modules/sharedInfrastructureModuleFactory";

type MakeBtcLegacyContainerArgs = {
  config: ClearSigningTesterConfig;
  logger: LoggerConfig;
  profile: LegacyCoinProfile<BtcLegacyErrorCodes>;
};

export const makeBtcLegacyContainer = ({
  config,
  logger,
  profile,
}: MakeBtcLegacyContainerArgs): Container => {
  const container = new Container();

  container.loadSync(
    configModuleFactory(config),
    sharedInfrastructureModuleFactory(config),
    btcLegacyInfrastructureModuleFactory(config, profile),
    btcLegacyApplicationModuleFactory(),
    loggerModuleFactory({ config: logger }),
  );

  return container;
};
