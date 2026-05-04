import { ContainerModule } from "inversify";

import { type ContextModuleDatasourceConfig } from "@/config/model/ContextModuleConfig";
import { HttpProxyDataSource } from "@/ethereum-loaders/proxy/data/HttpProxyDataSource";
import { HttpSafeProxyDataSource } from "@/ethereum-loaders/proxy/data/HttpSafeProxyDataSource";
import { ethereumProxyTypes } from "@/ethereum-loaders/proxy/di/ethereumProxyTypes";
import { ProxyContextFieldLoader } from "@/ethereum-loaders/proxy/domain/ProxyContextFieldLoader";

export const proxyModuleFactory = (
  datasource?: ContextModuleDatasourceConfig,
) =>
  new ContainerModule(({ bind }) => {
    if (datasource?.proxy === "safe") {
      bind(ethereumProxyTypes.EthereumProxyDataSource).to(
        HttpSafeProxyDataSource,
      );
    } else {
      bind(ethereumProxyTypes.EthereumProxyDataSource).to(HttpProxyDataSource);
    }
    bind(ethereumProxyTypes.EthereumProxyContextFieldLoader).to(
      ProxyContextFieldLoader,
    );
  });
