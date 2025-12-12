import { ContainerModule } from "inversify";

import { TYPES } from "@root/src/di/types";
import { type AppsConfig } from "@root/src/domain/models/config/AppsConfig";
import { type EtherscanConfig } from "@root/src/domain/models/config/EtherscanConfig";
import { type SignerConfig } from "@root/src/domain/models/config/SignerConfig";
import { type SpeculosConfig } from "@root/src/domain/models/config/SpeculosConfig";

export type ClearSigningTesterConfig = {
  speculos: SpeculosConfig;
  signer: SignerConfig;
  etherscan: EtherscanConfig;
  apps: AppsConfig;
  onlySpeculos?: boolean;
};

export const configModuleFactory = (config: ClearSigningTesterConfig) =>
  new ContainerModule(({ bind }) => {
    bind<SpeculosConfig>(TYPES.SpeculosConfig).toConstantValue(config.speculos);
    bind<SignerConfig>(TYPES.SignerConfig).toConstantValue(config.signer);
    bind<EtherscanConfig>(TYPES.EtherscanConfig).toConstantValue(
      config.etherscan,
    );
    bind<AppsConfig>(TYPES.AppsConfig).toConstantValue(config.apps);
  });
