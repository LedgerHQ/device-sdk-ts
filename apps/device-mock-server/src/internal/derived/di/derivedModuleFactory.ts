import { ContainerModule } from "inversify";

import { derivedTypes } from "@internal/derived/di/derivedTypes";
import { DerivedOsCommandsService } from "@internal/derived/service/DerivedOsCommandsService";

export const derivedModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(derivedTypes.Service).to(DerivedOsCommandsService).inSingletonScope();
  });
