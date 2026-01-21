import { type ContextModule } from "@ledgerhq/context-module";
import {
  type DeviceManagementKit,
  type DeviceSessionId,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { Container } from "inversify";

import { addressModuleFactory } from "@internal/address/di/addressModule";
import { appBindingModuleFactory } from "@internal/app-binder/di/appBinderModule";
import { NullLoggerPublisherService } from "@internal/app-binder/services/utils/NullLoggerPublisherService";
import { eip7702ModuleFactory } from "@internal/eip7702/di/eip7702Module";
import { externalTypes } from "@internal/externalTypes";
import { messageModuleFactory } from "@internal/message/di/messageModule";
import { safeModuleFactory } from "@internal/safe/di/safeModule";
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

  container
    .bind<
      (tag: string) => LoggerPublisherService
    >(externalTypes.DmkLoggerFactory)
    .toConstantValue((tag: string) => {
      const factory = dmk.getLoggerFactory?.();
      return factory
        ? factory(`SignerEth-${tag}`)
        : NullLoggerPublisherService(`SignerEth-${tag}`);
    });

  container.loadSync(
    addressModuleFactory(),
    appBindingModuleFactory(),
    eip7702ModuleFactory(),
    messageModuleFactory(),
    transactionModuleFactory(),
    typedDataModuleFactory(),
    safeModuleFactory(),
  );

  return container;
};
