import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { Container } from "inversify";

import { dataStoreModuleFactory } from "@internal/data-store/di/dataStoreModule";
import { externalTypes } from "@internal/externalTypes";
import { merkleTreeModuleFactory } from "@internal/merkle-tree/di/merkleTreeModule";
import { psbtModuleFactory } from "@internal/psbt/di/psbtModule";
import { useCasesModuleFactory } from "@internal/use-cases/di/useCasesModule";
import { walletModuleFactory } from "@internal/wallet/di/walletModule";

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

  container.loadSync(
    appBinderModuleFactory(),
    useCasesModuleFactory(),
    walletModuleFactory(),
    psbtModuleFactory(),
    dataStoreModuleFactory(),
    merkleTreeModuleFactory(),
  );

  return container;
};
