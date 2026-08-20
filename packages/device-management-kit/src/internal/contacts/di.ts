import { Container } from "inversify";

import { type DeviceSessionId } from "@api/device-session/types";
import { type DeviceManagementKit } from "@api/DeviceManagementKit";
import { type LoggerPublisherService } from "@api/logger-publisher/service/LoggerPublisherService";
import { contactsModuleFactory } from "@internal/contacts/di/contactsModule";
import { contactsExternalTypes } from "@internal/contacts/externalTypes";

export type MakeContactsContainerProps = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
};

export const makeContactsContainer = ({
  dmk,
  sessionId,
}: MakeContactsContainerProps) => {
  const container = new Container();

  container
    .bind<DeviceManagementKit>(contactsExternalTypes.Dmk)
    .toConstantValue(dmk);
  container
    .bind<DeviceSessionId>(contactsExternalTypes.SessionId)
    .toConstantValue(sessionId);
  container
    .bind<
      (tag: string) => LoggerPublisherService
    >(contactsExternalTypes.DmkLoggerFactory)
    .toConstantValue((tag: string) =>
      dmk.getLoggerFactory()(["ContactsService", tag]),
    );

  container.loadSync(contactsModuleFactory());

  return container;
};
