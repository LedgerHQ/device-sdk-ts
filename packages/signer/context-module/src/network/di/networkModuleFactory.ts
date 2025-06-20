import { ContainerModule } from "inversify";

import { HttpNetworkDataSource } from "@/network/data/HttpNetworkDataSource";
import { DynamicNetworkContextLoader } from "@/network/domain/DynamicNetworkContextLoader";

import { networkTypes } from "./networkTypes";

export const networkModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(networkTypes.NetworkDataSource).to(HttpNetworkDataSource);
    bind(networkTypes.DynamicNetworkContextLoader).to(
      DynamicNetworkContextLoader,
    );
  });
