import { type DeviceManagementKit } from "@ledgerhq/device-management-kit";
import { Container } from "inversify";

import { LKRPEnv } from "@api/index";
import { appBindingModuleFactory } from "@internal/app-binder/di/appBinderModule";

import { lkrpDatasourceModuleFactory } from "./lkrp-datasource/di/lkrpDatasourceModuleFactory";
import { useCasesModuleFactory } from "./use-cases/di/useCasesModule";
import { externalTypes } from "./externalTypes";

export type MakeContainerProps = {
  dmk: DeviceManagementKit;
  applicationId: number;
  env?: LKRPEnv;
  baseUrl?: string; // Optional base URL for the LKRP network requests
  stub?: boolean;
};

export const makeContainer = ({
  dmk,
  applicationId,
  env = LKRPEnv.PROD,
  baseUrl,
  stub,
}: MakeContainerProps) => {
  const container = new Container();

  container.bind<DeviceManagementKit>(externalTypes.Dmk).toConstantValue(dmk);
  container.bind(externalTypes.ApplicationId).toConstantValue(applicationId);

  container.loadSync(
    appBindingModuleFactory(),
    lkrpDatasourceModuleFactory({
      baseUrl: baseUrl ?? lkrpBaseUrlMap.get(env),
      stub,
    }),
    useCasesModuleFactory(),
  );

  return container;
};

const lkrpBaseUrlMap = new Map<LKRPEnv, string>([
  [LKRPEnv.PROD, "https://trustchain.api.live.ledger.com/v1"],
  [LKRPEnv.STAGING, "https://trustchain-backend.api.aws.stg.ldg-tech.com/v1"],
]);
