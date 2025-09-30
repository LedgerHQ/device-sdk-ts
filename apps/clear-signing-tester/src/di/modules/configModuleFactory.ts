import { ContainerModule } from "inversify";

import {
    DeviceConnectionConfig,
    SignerConfig,
} from "../../domain/repositories/DeviceRepository";
import { EtherscanConfig } from "../../services/EtherscanService";
import { TYPES } from "../types";

export interface ClearSigningTesterConfig {
    deviceConnection: DeviceConnectionConfig;
    signer: SignerConfig;
    etherscan: EtherscanConfig;
}

export const configModuleFactory = (config: ClearSigningTesterConfig) =>
    new ContainerModule(({ bind }) => {
        bind<DeviceConnectionConfig>(
            TYPES.DeviceConnectionConfig,
        ).toConstantValue(config.deviceConnection);
        bind<SignerConfig>(TYPES.SignerConfig).toConstantValue(config.signer);
        bind<EtherscanConfig>(TYPES.EtherscanConfig).toConstantValue(
            config.etherscan,
        );
    });
