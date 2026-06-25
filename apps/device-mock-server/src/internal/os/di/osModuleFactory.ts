import { ContainerModule } from "inversify";

import { osTypes } from "@internal/os/di/osTypes";
import { OsApduService } from "@internal/os/service/OsApduService";

export const osModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(osTypes.ApduService).to(OsApduService).inSingletonScope();
  });
