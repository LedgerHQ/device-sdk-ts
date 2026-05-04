import { ContainerModule } from "inversify";

import { HttpTrustedNameDataSource } from "@/ethereum-loaders/trusted-name/data/HttpTrustedNameDataSource";
import { type TrustedNameDataSource } from "@/ethereum-loaders/trusted-name/data/TrustedNameDataSource";
import { ethereumTrustedNameTypes } from "@/ethereum-loaders/trusted-name/di/ethereumTrustedNameTypes";
import { TrustedNameContextFieldLoader } from "@/ethereum-loaders/trusted-name/domain/TrustedNameContextFieldLoader";
import { TrustedNameContextLoader } from "@/ethereum-loaders/trusted-name/domain/TrustedNameContextLoader";

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
