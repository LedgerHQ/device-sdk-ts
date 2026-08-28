import {
  type DeviceManagementKit,
  type DeviceSessionId,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { Container } from "inversify";

import { type TronAddressBook } from "@api/model/TronAddressBook";
import { appBindingModuleFactory } from "@internal/app-binder/di/appBinderModule";
import { externalTypes } from "@internal/externalTypes";
import { addressModuleFactory } from "@internal/use-cases/address/di/addressModule";
import { appConfigurationModuleFactory } from "@internal/use-cases/app-configuration/di/appConfigurationModule";
import { ecdhModuleFactory } from "@internal/use-cases/ecdh/di/ecdhModule";
import { messageModuleFactory } from "@internal/use-cases/message/di/messageModule";
import { transactionModuleFactory } from "@internal/use-cases/transaction/di/transactionModule";

type MakeContainerProps = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
  addressBook?: TronAddressBook;
};

export const makeContainer = ({
  dmk,
  sessionId,
  addressBook,
}: MakeContainerProps) => {
  const container = new Container();

  container.bind<DeviceManagementKit>(externalTypes.Dmk).toConstantValue(dmk);
  container
    .bind<DeviceSessionId>(externalTypes.SessionId)
    .toConstantValue(sessionId);
  // Always bound: an absent address book is an empty one, which simply never
  // matches, so consumers never have to handle `undefined`.
  container
    .bind<TronAddressBook>(externalTypes.AddressBook)
    .toConstantValue(addressBook ?? { contactGroups: [], ledgerAccounts: [] });

  container
    .bind<
      (tag: string) => LoggerPublisherService
    >(externalTypes.DmkLoggerFactory)
    .toConstantValue((tag: string) =>
      dmk.getLoggerFactory()(["SignerTron", tag]),
    );

  container.loadSync(
    appBindingModuleFactory(),
    addressModuleFactory(),
    transactionModuleFactory(),
    messageModuleFactory(),
    appConfigurationModuleFactory(),
    ecdhModuleFactory(),
  );

  return container;
};
