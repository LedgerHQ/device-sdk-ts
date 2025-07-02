import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { Container } from "inversify";

import { appBindingModuleFactory } from "@internal/app-binder/di/appBinderModule";

import { lkrpDatasourceModuleFactory } from "./lkrp-datasource/di/lkrpDatasourceModuleFactory";
import { externalTypes } from "./externalTypes";

export type MakeContainerProps = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
  baseUrl?: string; // Optional base URL for the LKRP network requests
  stub?: boolean;
};

export const makeContainer = ({
  dmk,
  sessionId,
  baseUrl,
  stub,
}: MakeContainerProps) => {
  const container = new Container();

  container.bind<DeviceManagementKit>(externalTypes.Dmk).toConstantValue(dmk);
  container
    .bind<DeviceSessionId>(externalTypes.SessionId)
    .toConstantValue(sessionId);

  container.loadSync(
    appBindingModuleFactory(),
    lkrpDatasourceModuleFactory({ baseUrl, stub }),
  );

  return container;
};
