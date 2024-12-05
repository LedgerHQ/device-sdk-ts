import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { Container } from "inversify";

import { externalTypes } from "@internal/externalTypes";
import { useCasesModuleFactory } from "@internal/use-cases/di/useCasesModule";

import { appBinderModuleFactory } from "./app-binder/di/appBinderModule";

type MakeContainerProps = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
};
export const makeContainer = ({ dmk, sessionId }: MakeContainerProps) => {
  const container = new Container();

  container.bind<DeviceManagementKit>(externalTypes.Dmk).toConstantValue(dmk);
  container
    .bind<DeviceSessionId>(externalTypes.SessionId)
    .toConstantValue(sessionId);

  container.load(appBinderModuleFactory(), useCasesModuleFactory());

  return container;
};
