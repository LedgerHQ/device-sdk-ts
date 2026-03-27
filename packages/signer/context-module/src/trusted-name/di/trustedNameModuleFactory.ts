import { ContainerModule } from "inversify";

import { HttpTrustedNameDataSource } from "@/trusted-name/data/HttpTrustedNameDataSource";
import { type TrustedNameDataSource } from "@/trusted-name/data/TrustedNameDataSource";
import { trustedNameTypes } from "@/trusted-name/di/trustedNameTypes";
import { TrustedNameContextFieldLoader } from "@/trusted-name/domain/TrustedNameContextFieldLoader";
import { TrustedNameContextLoader } from "@/trusted-name/domain/TrustedNameContextLoader";

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
