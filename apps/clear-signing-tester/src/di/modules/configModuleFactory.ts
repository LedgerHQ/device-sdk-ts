import { ContainerModule } from "inversify";

import { TYPES } from "../types";
import { SpeculosConfig } from "@root/src/domain/models/config/SpeculosConfig";
import { SignerConfig } from "@root/src/domain/models/config/SignerConfig";
import { EtherscanConfig } from "@root/src/domain/models/config/EtherscanConfig";

export interface ClearSigningTesterConfig {
    speculos: SpeculosConfig;
    signer: SignerConfig;
    etherscan: EtherscanConfig;
}

export const configModuleFactory = (config: ClearSigningTesterConfig) =>
    new ContainerModule(({ bind }) => {
        bind<SpeculosConfig>(TYPES.SpeculosConfig).toConstantValue(
            config.speculos,
        );
        bind<SignerConfig>(TYPES.SignerConfig).toConstantValue(config.signer);
        bind<EtherscanConfig>(TYPES.EtherscanConfig).toConstantValue(
            config.etherscan,
        );
    });
