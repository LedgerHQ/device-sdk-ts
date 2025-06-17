import { type Either } from "purify-ts";

import { type NetworkConfiguration } from "@/network/domain/NetworkConfigurationLoader";

export interface NetworkDataSource {
  getNetworkConfiguration(
    chainId: number,
  ): Promise<Either<Error, NetworkConfiguration>>;
}
