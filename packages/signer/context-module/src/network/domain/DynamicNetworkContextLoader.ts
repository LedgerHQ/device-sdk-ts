import { inject, injectable } from "inversify";

import { ContextLoader } from "@/shared/domain/ContextLoader";
import {
  ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";
import {
  TransactionContext,
  TransactionFieldContext,
} from "@/shared/model/TransactionContext";
import { networkTypes } from "@/network/di/networkTypes";

import { NetworkConfigurationLoader } from "./NetworkConfigurationLoader";

@injectable()
export class DynamicNetworkContextLoader implements ContextLoader {
  private readonly _networkConfigurationLoader: NetworkConfigurationLoader;

  constructor(
    @inject(networkTypes.NetworkConfigurationLoader)
    networkConfigurationLoader: NetworkConfigurationLoader,
  ) {
    this._networkConfigurationLoader = networkConfigurationLoader;
  }

  async load(transaction: TransactionContext): Promise<ClearSignContext[]> {
    const configuration = await this._networkConfigurationLoader.load(
      transaction.chainId,
    );

    if (!configuration) {
      return [];
    }

    const descriptor =
      configuration.descriptors[transaction.deviceModelId];

    if (!descriptor) {
      return [];
    }

    // Return the dynamic network context with the descriptor data
    return [
      {
        type: ClearSignContextType.DYNAMIC_NETWORK,
        payload: descriptor.data,
      },
    ];
  }

  // Dynamic network context doesn't support field-level loading
  async loadField(
    field: TransactionFieldContext,
  ): Promise<ClearSignContext | null> {
    return null;
  }
}