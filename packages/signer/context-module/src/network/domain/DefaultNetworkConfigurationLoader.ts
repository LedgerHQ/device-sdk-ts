import { inject, injectable } from "inversify";

import { type NetworkDataSource } from "@/network/data/NetworkDataSource";
import { networkTypes } from "@/network/di/networkTypes";
import { type ContextLoader } from "@/shared/domain/ContextLoader";
import {
  type ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";
import {
  type TransactionContext,
  type TransactionFieldContext,
} from "@/shared/model/TransactionContext";

@injectable()
export class DefaultNetworkConfigurationLoader implements ContextLoader {
  private readonly _dataSource: NetworkDataSource;

  constructor(
    @inject(networkTypes.NetworkDataSource) dataSource: NetworkDataSource,
  ) {
    this._dataSource = dataSource;
  }

  async load(transaction: TransactionContext): Promise<ClearSignContext[]> {
    const result = await this._dataSource.getNetworkConfiguration(
      transaction.chainId,
    );

    return result.caseOf({
      Left: () => [],
      Right: (config) => {
        const descriptor = config.descriptors[transaction.deviceModelId];

        if (!descriptor) {
          return [];
        }

        return [
          {
            type: ClearSignContextType.DYNAMIC_NETWORK,
            payload: descriptor.data,
          },
        ];
      },
    });
  }

  async loadField(
    field: TransactionFieldContext,
  ): Promise<ClearSignContext | null> {
    // Network configuration doesn't support field-level loading
    return null;
  }
}
