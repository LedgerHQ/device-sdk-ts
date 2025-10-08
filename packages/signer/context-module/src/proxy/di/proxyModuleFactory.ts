import { ContainerModule } from "inversify";

import { type ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import { HttpProxyDataSource } from "@/proxy/data/HttpProxyDataSource";
import { HttpSafeProxyDataSource } from "@/proxy/data/HttpSafeProxyDataSource";
import { proxyTypes } from "@/proxy/di/proxyTypes";
import { ProxyContextFieldLoader } from "@/proxy/domain/ProxyContextFieldLoader";

export const proxyModuleFactory = (config?: ContextModuleConfig) =>
  new ContainerModule(({ bind }) => {
    if (config?.datasource?.proxy === "safe") {
      bind(proxyTypes.ProxyDataSource).to(HttpSafeProxyDataSource);
    } else {
      bind(proxyTypes.ProxyDataSource).to(HttpProxyDataSource);
    }
    bind(proxyTypes.ProxyContextFieldLoader).to(ProxyContextFieldLoader);
  });
