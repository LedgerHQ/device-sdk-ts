import { ContainerModule } from "inversify";

import { HttpSolanaTrustedNameDataSource } from "@/modules/solana/trusted-name/data/HttpTrustedNameDataSource";
import { solanaTrustedNameTypes } from "@/modules/solana/trusted-name/di/trustedNameTypes";
import { SolanaTrustedNameContextLoader } from "@/modules/solana/trusted-name/domain/TrustedNameContextLoader";

export const solanaTrustedNameModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(solanaTrustedNameTypes.SolanaTrustedNameDataSource).to(
      HttpSolanaTrustedNameDataSource,
    );
    bind(solanaTrustedNameTypes.SolanaTrustedNameContextLoader).to(
      SolanaTrustedNameContextLoader,
    );
  });
