import { type ContextModule } from "@ledgerhq/context-module";
import {
  type DeviceManagementKit,
  type DeviceSessionId,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { Container } from "inversify";

import {
  EMPTY_EVM_ADDRESS_BOOK,
  type EvmAddressBook,
} from "@api/model/EvmAddressBook";
import { addressModuleFactory } from "@internal/address/di/addressModule";
import { appBindingModuleFactory } from "@internal/app-binder/di/appBinderModule";
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
  addressBook?: EvmAddressBook;
};

export const makeContainer = ({
  dmk,
  sessionId,
  contextModule,
  addressBook,
}: MakeContainerProps) => {
  const container = new Container();

  container.bind<DeviceManagementKit>(externalTypes.Dmk).toConstantValue(dmk);
  container
    .bind<ContextModule>(externalTypes.ContextModule)
    .toConstantValue(contextModule);
  container
    .bind<DeviceSessionId>(externalTypes.SessionId)
    .toConstantValue(sessionId);
  // Always bound: an absent address book is an empty one, which simply never
  // matches, so consumers never have to handle `undefined`.
  container
    .bind<EvmAddressBook>(externalTypes.AddressBook)
    .toConstantValue(addressBook ?? EMPTY_EVM_ADDRESS_BOOK);

  container
    .bind<
      (tag: string) => LoggerPublisherService
    >(externalTypes.DmkLoggerFactory)
    .toConstantValue((tag: string) =>
      dmk.getLoggerFactory()(["SignerEth", tag]),
    );

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
