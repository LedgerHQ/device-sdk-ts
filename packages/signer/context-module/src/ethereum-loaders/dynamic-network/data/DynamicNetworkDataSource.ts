import { type Either } from "purify-ts";

import { type DynamicNetworkConfiguration } from "@/ethereum-loaders/dynamic-network/model/DynamicNetworkConfiguration";

export interface DynamicNetworkDataSource {
  getDynamicNetworkConfiguration(
    chainId: number,
  ): Promise<Either<Error, DynamicNetworkConfiguration>>;
}
