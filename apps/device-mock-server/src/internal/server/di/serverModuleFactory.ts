import { ContainerModule } from "inversify";

import { serverTypes } from "@internal/server/di/serverTypes";
import { HttpAppFactory } from "@internal/server/HttpAppFactory";
import { AuthRoutes } from "@internal/server/routes/AuthRoutes";
import { CatalogRoutes } from "@internal/server/routes/CatalogRoutes";
import { DeviceRoutes } from "@internal/server/routes/DeviceRoutes";
import { SessionsRoutes } from "@internal/server/routes/SessionsRoutes";
import { TransferRoutes } from "@internal/server/routes/TransferRoutes";

export const serverModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(serverTypes.AuthRoutes).to(AuthRoutes).inSingletonScope();
    bind(serverTypes.SessionsRoutes).to(SessionsRoutes).inSingletonScope();
    bind(serverTypes.DeviceRoutes).to(DeviceRoutes).inSingletonScope();
    bind(serverTypes.CatalogRoutes).to(CatalogRoutes).inSingletonScope();
    bind(serverTypes.TransferRoutes).to(TransferRoutes).inSingletonScope();
    bind(serverTypes.HttpAppFactory).to(HttpAppFactory).inSingletonScope();
  });
