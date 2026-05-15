import { type ContextModule } from "@ledgerhq/context-module";
import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { Container } from "inversify";

import { appBindingModuleFactory } from "@internal/app-binder/di/appBinderModule";
import { externalTypes } from "@internal/externalTypes";
import { addressModuleFactory } from "@internal/use-cases/address/di/addressModule";
import { configModuleFactory } from "@internal/use-cases/config/di/configModule";
import { transactionModuleFactory } from "@internal/use-cases/transaction/di/transactionModule";

type MakeContainerProps = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
  contextModule?: ContextModule;
};

export const makeContainer = ({
  dmk,
  sessionId,
  contextModule,
}: MakeContainerProps) => {
  const container = new Container();

  container.bind<DeviceManagementKit>(externalTypes.Dmk).toConstantValue(dmk);
  container
    .bind<DeviceSessionId>(externalTypes.SessionId)
    .toConstantValue(sessionId);

  if (contextModule) {
    container
      .bind<ContextModule>(externalTypes.ContextModule)
      .toConstantValue(contextModule);
  }

  container.loadSync(
    appBindingModuleFactory(),
    configModuleFactory(),
    addressModuleFactory(),
    transactionModuleFactory(),
  );

  return container;
};
