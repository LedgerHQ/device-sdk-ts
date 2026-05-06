import { ContainerModule } from "inversify";

import { HttpTrustedNameDataSource } from "@/modules/ethereum/trusted-name/data/HttpTrustedNameDataSource";
import { type TrustedNameDataSource } from "@/modules/ethereum/trusted-name/data/TrustedNameDataSource";
import { trustedNameTypes } from "@/modules/ethereum/trusted-name/di/trustedNameTypes";
import { TrustedNameContextFieldLoader } from "@/modules/ethereum/trusted-name/domain/TrustedNameContextFieldLoader";
import { TrustedNameContextLoader } from "@/modules/ethereum/trusted-name/domain/TrustedNameContextLoader";

export const trustedNameModuleFactory = (
  customTrustedNameDataSource?: TrustedNameDataSource,
) =>
  new ContainerModule(({ bind }) => {
    if (customTrustedNameDataSource) {
      bind(trustedNameTypes.TrustedNameDataSource).toConstantValue(
        customTrustedNameDataSource,
      );
    } else {
      bind(trustedNameTypes.TrustedNameDataSource).to(
        HttpTrustedNameDataSource,
      );
    }
    bind(trustedNameTypes.TrustedNameContextLoader).to(
      TrustedNameContextLoader,
    );
    bind(trustedNameTypes.TrustedNameContextFieldLoader).to(
      TrustedNameContextFieldLoader,
    );
  });
