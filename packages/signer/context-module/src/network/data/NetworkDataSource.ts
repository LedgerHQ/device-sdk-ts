import { type Either } from "purify-ts";

import { type NetworkConfiguration } from "@/network/model/NetworkConfiguration";

export interface NetworkDataSource {
  getNetworkConfiguration(
    chainId: number,
  ): Promise<Either<Error, NetworkConfiguration>>;
}
