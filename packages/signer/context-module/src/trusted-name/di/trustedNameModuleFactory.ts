import { ContainerModule } from "inversify";

import { HttpTrustedNameDataSource } from "@/trusted-name/data/HttpTrustedNameDataSource";
import { trustedNameTypes } from "@/trusted-name/di/trustedNameTypes";
import { TrustedNameContextLoader } from "@/trusted-name/domain/TrustedNameContextLoader";

export const trustedNameModuleFactory = () =>
  new ContainerModule((bind, _unbind, _isBound, _rebind) => {
    bind(trustedNameTypes.TrustedNameDataSource).to(HttpTrustedNameDataSource);
    bind(trustedNameTypes.TrustedNameContextLoader).to(
      TrustedNameContextLoader,
    );
  });
