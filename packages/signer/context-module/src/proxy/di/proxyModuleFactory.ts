import { ContainerModule } from "inversify";

import { HttpProxyDataSource } from "@/proxy/data/HttpProxyDataSource";
import { proxyTypes } from "@/proxy/di/proxyTypes";
import { ProxyContextFieldLoader } from "@/proxy/domain/ProxyContextFieldLoader";

export const proxyModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(proxyTypes.ProxyDataSource).to(HttpProxyDataSource);
    bind(proxyTypes.ProxyContextFieldLoader).to(ProxyContextFieldLoader);
  });
