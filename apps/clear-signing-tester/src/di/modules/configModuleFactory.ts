import { ContainerModule } from "inversify";

import { TYPES } from "@root/src/di/types";
import { type CalConfig } from "@root/src/domain/models/config/CalConfig";
import { type EtherscanConfig } from "@root/src/domain/models/config/EtherscanConfig";
import { type SignerConfig } from "@root/src/domain/models/config/SignerConfig";
import { type SolanaRpcConfig } from "@root/src/domain/models/config/SolanaRpcConfig";
import { type SpeculinhoConfig } from "@root/src/domain/models/config/SpeculinhoConfig";

export type ClearSigningTesterConfig = {
  speculinho: SpeculinhoConfig;
  signer: SignerConfig;
  cal: CalConfig;
  etherscan: EtherscanConfig;
  solanaRpc?: SolanaRpcConfig;
  onlySpeculos?: boolean;
};

export const configModuleFactory = (config: ClearSigningTesterConfig) =>
  new ContainerModule(({ bind }) => {
    bind<SpeculinhoConfig>(TYPES.SpeculinhoConfig).toConstantValue(
      config.speculinho,
    );
    bind<SignerConfig>(TYPES.SignerConfig).toConstantValue(config.signer);
    bind<EtherscanConfig>(TYPES.EtherscanConfig).toConstantValue(
      config.etherscan,
    );
    bind<CalConfig>(TYPES.CalConfig).toConstantValue(config.cal);
    if (config.solanaRpc) {
      bind<SolanaRpcConfig>(TYPES.SolanaRpcConfig).toConstantValue(
        config.solanaRpc,
      );
    }
  });
