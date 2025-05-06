import { type ContextModule } from "@ledgerhq/context-module";
import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { Container } from "inversify";

import { addressModuleFactory } from "@internal/address/di/addressModule";
import { appBindingModuleFactory } from "@internal/app-binder/di/appBinderModule";
import { externalTypes } from "@internal/externalTypes";
import { messageModuleFactory } from "@internal/message/di/messageModule";
import { transactionModuleFactory } from "@internal/transaction/di/transactionModule";
import { typedDataModuleFactory } from "@internal/typed-data/di/typedDataModule";

export type MakeContainerProps = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
  contextModule: ContextModule;
};

export const makeContainer = ({
  dmk,
  sessionId,
  contextModule,
}: MakeContainerProps) => {
  const container = new Container();

  container.bind<DeviceManagementKit>(externalTypes.Dmk).toConstantValue(dmk);
  container
    .bind<ContextModule>(externalTypes.ContextModule)
    .toConstantValue(contextModule);
  container
    .bind<DeviceSessionId>(externalTypes.SessionId)
    .toConstantValue(sessionId);

  container.loadSync(
    addressModuleFactory(),
    appBindingModuleFactory(),
    messageModuleFactory(),
    transactionModuleFactory(),
    typedDataModuleFactory(),
  );

  return container;
};
