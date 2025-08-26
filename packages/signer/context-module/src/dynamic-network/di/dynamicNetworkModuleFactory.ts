import { ContainerModule } from "inversify";

import { HttpDynamicNetworkDataSource } from "@/dynamic-network/data/HttpDynamicNetworkDataSource";
import { DynamicNetworkContextLoader } from "@/dynamic-network/domain/DynamicNetworkContextLoader";

import { dynamicNetworkTypes } from "./dynamicNetworkTypes";

export const dynamicNetworkModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(dynamicNetworkTypes.DynamicNetworkDataSource).to(
      HttpDynamicNetworkDataSource,
    );
    bind(dynamicNetworkTypes.DynamicNetworkContextLoader).to(
      DynamicNetworkContextLoader,
    );
  });
