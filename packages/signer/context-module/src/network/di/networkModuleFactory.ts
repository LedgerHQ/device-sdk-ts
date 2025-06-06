import axios from "axios";
import { ContainerModule } from "inversify";

import { configTypes } from "@/config/di/configTypes";
import { type ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import { HttpNetworkDataSource } from "@/network/data/HttpNetworkDataSource";
import { type NetworkDataSource } from "@/network/data/NetworkDataSource";
import { DefaultNetworkConfigurationLoader } from "@/network/domain/DefaultNetworkConfigurationLoader";
import { type NetworkConfigurationLoader } from "@/network/domain/NetworkConfigurationLoader";

import { networkTypes } from "./networkTypes";

export const networkModuleFactory = () =>
  new ContainerModule((bind, _unbind, _isBound, _rebind, _unbindAsync, _onActivation, _onDeactivation) => {
    bind<NetworkDataSource>(networkTypes.NetworkDataSource).toDynamicValue(
      (context) => {
        const config = context.container.get<ContextModuleConfig>(
          configTypes.ContextModuleConfig,
        );
        const api = axios.create({
          baseURL: config.cal.url,
          headers: {
            "X-Ledger-Client-Version": config.cal.clientVersion,
          },
        });
        return new HttpNetworkDataSource(api);
      },
    );

    bind<NetworkConfigurationLoader>(networkTypes.NetworkConfigurationLoader).to(
      DefaultNetworkConfigurationLoader,
    );
  });