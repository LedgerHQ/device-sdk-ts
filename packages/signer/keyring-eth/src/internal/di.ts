import { ContextModule } from "@ledgerhq/context-module";
import { DeviceSdk } from "@ledgerhq/device-sdk-core";
import { Container } from "inversify";
import { makeLoggerMiddleware } from "inversify-logger-middleware";

import { addressModuleFactory } from "@internal/address/di/addressModule";
import { appBindingModuleFactory } from "@internal/app-binding/di/appBindingModule";
import { externalTypes } from "@internal/externalTypes";
import { messageModuleFactory } from "@internal/message/di/messageModule";
import { transactionModuleFactory } from "@internal/transaction/di/transactionModule";
import { typedDataModuleFactory } from "@internal/typed-data/di/typedDataModule";

// Uncomment this line to enable the logger middleware
const logger = makeLoggerMiddleware();

export type MakeContainerProps = {
  sdk: DeviceSdk;
  contextModule: ContextModule;
};

export const makeContainer = ({ sdk, contextModule }: MakeContainerProps) => {
  const container = new Container();

  // Uncomment this line to enable the logger middleware
  container.applyMiddleware(logger);

  container.bind<DeviceSdk>(externalTypes.Sdk).toConstantValue(sdk);
  container
    .bind<ContextModule>(externalTypes.ContextModule)
    .toConstantValue(contextModule);

  container.load(
    addressModuleFactory(),
    appBindingModuleFactory(),
    messageModuleFactory(),
    transactionModuleFactory(),
    typedDataModuleFactory(),
  );

  return container;
};
