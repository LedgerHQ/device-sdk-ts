import { DmkNetworkClient } from "@ledgerhq/device-management-kit";
import { ContainerModule } from "inversify";

import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import { networkTypes } from "@/network/di/networkTypes";
import {
  LEDGER_CLIENT_VERSION_HEADER,
  LEDGER_ORIGIN_TOKEN_HEADER,
} from "@/shared/constant/HttpHeaders";
import PACKAGE from "@root/package.json";

export const networkModuleFactory = (config: ContextModuleServiceConfig) =>
  new ContainerModule(({ bind }) => {
    bind<DmkNetworkClient>(networkTypes.NetworkClient).toConstantValue(
      new DmkNetworkClient({
        headers: {
          [LEDGER_CLIENT_VERSION_HEADER]: `context-module/${PACKAGE.version}`,
          ...(config.originToken && {
            [LEDGER_ORIGIN_TOKEN_HEADER]: config.originToken,
          }),
        },
      }),
    );
  });
