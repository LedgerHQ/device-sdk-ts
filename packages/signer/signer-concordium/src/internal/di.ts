import {
  type DeviceManagementKit,
  type DeviceSessionId,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { Container } from "inversify";

import { appBindingModuleFactory } from "@internal/app-binder/di/appBinderModule";
import { externalTypes } from "@internal/externalTypes";
import { credentialDeploymentModuleFactory } from "@internal/use-cases/credential-deployment/di/credentialDeploymentModule";
import { publicKeyModuleFactory } from "@internal/use-cases/publickey/di/publicKeyModule";
import { transactionModuleFactory } from "@internal/use-cases/transaction/di/transactionModule";

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

  container
    .bind<
      (tag: string) => LoggerPublisherService
    >(externalTypes.DmkLoggerFactory)
    .toConstantValue((tag: string) =>
      dmk.getLoggerFactory()(["SignerConcordium", tag]),
    );

  container.loadSync(
    appBindingModuleFactory(),
    credentialDeploymentModuleFactory(),
    publicKeyModuleFactory(),
    transactionModuleFactory(),
  );

  return container;
};
