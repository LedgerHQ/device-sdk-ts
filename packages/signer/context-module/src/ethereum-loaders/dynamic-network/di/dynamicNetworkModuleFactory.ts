import { ContainerModule } from "inversify";

import { HttpDynamicNetworkDataSource } from "@/ethereum-loaders/dynamic-network/data/HttpDynamicNetworkDataSource";
import { DynamicNetworkContextLoader } from "@/ethereum-loaders/dynamic-network/domain/DynamicNetworkContextLoader";

import { ethereumDynamicNetworkTypes } from "./ethereumDynamicNetworkTypes";

export const dynamicNetworkModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(ethereumDynamicNetworkTypes.EthereumDynamicNetworkDataSource).to(
      HttpDynamicNetworkDataSource,
    );
    bind(ethereumDynamicNetworkTypes.EthereumDynamicNetworkContextLoader).to(
      DynamicNetworkContextLoader,
    );
  });
