import { inject, injectable } from "inversify";

import { type NetworkDataSource } from "@/network/data/NetworkDataSource";
import { networkTypes } from "@/network/di/networkTypes";
import { ContextLoader } from "@/shared/domain/ContextLoader";
import {
  ClearSignContext,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";
import {
  TransactionContext,
  TransactionFieldContext,
} from "@/shared/model/TransactionContext";

@injectable()
export class DynamicNetworkContextLoader implements ContextLoader {
  private readonly _networkDataSource: NetworkDataSource;

  constructor(
    @inject(networkTypes.NetworkDataSource)
    networkDataSource: NetworkDataSource,
  ) {
    this._networkDataSource = networkDataSource;
  }

  async load(transaction: TransactionContext): Promise<ClearSignContext[]> {
    const result = await this._networkDataSource.getNetworkConfiguration(
      transaction.chainId,
    );

    return result.caseOf({
      Left: () => [],
      Right: (configuration) => {
        const descriptor = configuration.descriptors[transaction.deviceModelId];

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

  // Dynamic network context doesn't support field-level loading
  loadField(_field: TransactionFieldContext): Promise<ClearSignContext | null> {
    return Promise.resolve(null);
  }
}
