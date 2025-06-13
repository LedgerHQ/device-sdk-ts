import { inject, injectable } from "inversify";

import { type NetworkDataSource } from "@/network/data/NetworkDataSource";
import { networkTypes } from "@/network/di/networkTypes";

import {
  type NetworkConfiguration,
  type NetworkConfigurationLoader,
} from "./NetworkConfigurationLoader";

@injectable()
export class DefaultNetworkConfigurationLoader
  implements NetworkConfigurationLoader
{
  private readonly _dataSource: NetworkDataSource;

  constructor(
    @inject(networkTypes.NetworkDataSource) dataSource: NetworkDataSource,
  ) {
    this._dataSource = dataSource;
  }

  async load(chainId: number): Promise<NetworkConfiguration | null> {
    const result = await this._dataSource.getNetworkConfiguration(chainId);
    return result.caseOf({
      Left: () => null,
      Right: (config) => config,
    });
  }
}