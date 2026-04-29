import { ContainerModule } from "inversify";

import { type ContextModuleDatasourceConfig } from "@/config/model/ContextModuleConfig";
import { HttpProxyDataSource } from "@/proxy/data/HttpProxyDataSource";
import { HttpSafeProxyDataSource } from "@/proxy/data/HttpSafeProxyDataSource";
import { proxyTypes } from "@/proxy/di/proxyTypes";
import { ProxyContextFieldLoader } from "@/proxy/domain/ProxyContextFieldLoader";

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
