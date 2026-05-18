import { ContainerModule } from "inversify";

import { type ContextModuleDatasourceConfig } from "@/config/model/ContextModuleConfig";
import { HttpProxyDataSource } from "@/modules/ethereum/proxy/data/HttpProxyDataSource";
import { HttpSafeProxyDataSource } from "@/modules/ethereum/proxy/data/HttpSafeProxyDataSource";
import { proxyTypes } from "@/modules/ethereum/proxy/di/proxyTypes";
import { ProxyContextFieldLoader } from "@/modules/ethereum/proxy/domain/ProxyContextFieldLoader";

export const proxyModuleFactory = (
  datasource?: ContextModuleDatasourceConfig,
) =>
  new ContainerModule(({ bind }) => {
    if (datasource?.proxy === "safe") {
      bind(proxyTypes.ProxyDataSource).to(HttpSafeProxyDataSource);
    } else {
      bind(proxyTypes.ProxyDataSource).to(HttpProxyDataSource);
    }
    bind(proxyTypes.ProxyContextFieldLoader).to(ProxyContextFieldLoader);
  });
