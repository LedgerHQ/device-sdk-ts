import { ContainerModule } from "inversify";

import { type ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import { HttpTrustedNameDataSource } from "@/trusted-name/data/HttpTrustedNameDataSource";
import { trustedNameTypes } from "@/trusted-name/di/trustedNameTypes";
import { TrustedNameContextFieldLoader } from "@/trusted-name/domain/TrustedNameContextFieldLoader";
import { TrustedNameContextLoader } from "@/trusted-name/domain/TrustedNameContextLoader";

export const trustedNameModuleFactory = (config?: ContextModuleConfig) =>
  new ContainerModule(({ bind }) => {
    if (config?.customTrustedNameDataSource) {
      bind(trustedNameTypes.TrustedNameDataSource).toConstantValue(
        config.customTrustedNameDataSource,
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
