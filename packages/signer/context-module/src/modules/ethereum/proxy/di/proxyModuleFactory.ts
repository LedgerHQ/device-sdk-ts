import { ContainerModule } from "inversify";

import { type ContextModuleDatasourceConfig } from "@/config/model/ContextModuleConfig";
import { HttpProxyDataSource } from "@/modules/ethereum/proxy/data/HttpProxyDataSource";
import { HttpSafeProxyDataSource } from "@/modules/ethereum/proxy/data/HttpSafeProxyDataSource";
import { ethereumProxyTypes } from "@/modules/ethereum/proxy/di/ethereumProxyTypes";
import { ProxyContextFieldLoader } from "@/modules/ethereum/proxy/domain/ProxyContextFieldLoader";

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
