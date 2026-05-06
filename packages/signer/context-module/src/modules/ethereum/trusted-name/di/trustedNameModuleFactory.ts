import { ContainerModule } from "inversify";

import { HttpTrustedNameDataSource } from "@/modules/ethereum/trusted-name/data/HttpTrustedNameDataSource";
import { type TrustedNameDataSource } from "@/modules/ethereum/trusted-name/data/TrustedNameDataSource";
import { ethereumTrustedNameTypes } from "@/modules/ethereum/trusted-name/di/ethereumTrustedNameTypes";
import { TrustedNameContextFieldLoader } from "@/modules/ethereum/trusted-name/domain/TrustedNameContextFieldLoader";
import { TrustedNameContextLoader } from "@/modules/ethereum/trusted-name/domain/TrustedNameContextLoader";

export const trustedNameModuleFactory = (
  customTrustedNameDataSource?: TrustedNameDataSource,
) =>
  new ContainerModule(({ bind }) => {
    if (customTrustedNameDataSource) {
      bind(
        ethereumTrustedNameTypes.EthereumTrustedNameDataSource,
      ).toConstantValue(customTrustedNameDataSource);
    } else {
      bind(ethereumTrustedNameTypes.EthereumTrustedNameDataSource).to(
        HttpTrustedNameDataSource,
      );
    }
    bind(ethereumTrustedNameTypes.EthereumTrustedNameContextLoader).to(
      TrustedNameContextLoader,
    );
    bind(ethereumTrustedNameTypes.EthereumTrustedNameContextFieldLoader).to(
      TrustedNameContextFieldLoader,
    );
  });
