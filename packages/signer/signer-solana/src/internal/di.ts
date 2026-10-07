import { type ContextModule } from "@ledgerhq/context-module";
import {
  type DeviceManagementKit,
  type DeviceSessionId,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { Container } from "inversify";

import {
  EMPTY_SOLANA_ADDRESS_BOOK,
  type SolanaAddressBook,
} from "@api/model/SolanaAddressBook";

import { appBinderModuleFactory } from "./app-binder/di/appBinderModule";
import { useCasesModuleFactory } from "./use-cases/di/useCasesModule";
import { externalTypes } from "./externalTypes";

export type MakeContainerProps = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
  contextModule: ContextModule;
  solanaRPCURL?: string;
  addressBook?: SolanaAddressBook;
};

export const makeContainer = ({
  dmk,
  sessionId,
  contextModule,
  solanaRPCURL,
  addressBook,
}: MakeContainerProps) => {
  const container = new Container();

  container.bind<DeviceManagementKit>(externalTypes.Dmk).toConstantValue(dmk);
  container
    .bind<DeviceSessionId>(externalTypes.SessionId)
    .toConstantValue(sessionId);
  container
    .bind<ContextModule>(externalTypes.ContextModule)
    .toConstantValue(contextModule);
  container
    .bind<string | undefined>(externalTypes.SolanaRPCURL)
    .toConstantValue(solanaRPCURL);
  // Always bound: an absent address book is an empty one, which simply never
  // matches, so consumers never have to handle `undefined`.
  container
    .bind<SolanaAddressBook>(externalTypes.AddressBook)
    .toConstantValue(addressBook ?? EMPTY_SOLANA_ADDRESS_BOOK);

  container
    .bind<
      (tag: string) => LoggerPublisherService
    >(externalTypes.DmkLoggerFactory)
    .toConstantValue((tag: string) =>
      dmk.getLoggerFactory()(["SignerSolana", tag]),
    );

  container.loadSync(appBinderModuleFactory(), useCasesModuleFactory());

  return container;
};
