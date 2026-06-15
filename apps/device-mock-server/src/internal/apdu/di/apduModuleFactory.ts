import { ContainerModule } from "inversify";

import { apduTypes } from "@internal/apdu/di/apduTypes";
import { ApduResolverService } from "@internal/apdu/service/ApduResolverService";

export const apduModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(apduTypes.Resolver).to(ApduResolverService).inSingletonScope();
  });
