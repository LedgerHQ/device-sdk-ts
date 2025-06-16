import { type AxiosInstance } from "axios";
import { injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import { type NetworkConfiguration } from "@/network/domain/NetworkConfigurationLoader";

import { type NetworkDataSource } from "./NetworkDataSource";

type NetworkApiResponse = {
  data: Array<{
    id: string;
    descriptors: Array<{
      device_model: string;
      descriptor: {
        type: string;
        version: string;
        data: string;
      };
      signatures: {
        prod: string;
        test: string;
      };
    }>;
    icons: {
      flex: string;
      stax: string;
    };
  }>;
};

@injectable()
export class HttpNetworkDataSource implements NetworkDataSource {
  private readonly _api: AxiosInstance;

  constructor(api: AxiosInstance) {
    this._api = api;
  }

  async getNetworkConfiguration(
    chainId: number,
  ): Promise<Either<Error, NetworkConfiguration>> {
    try {
      const response = await this._api.get<NetworkApiResponse>(
        `/v1/networks?output=id,descriptors,icons&chain_id=${chainId}`,
      );

      const networkData = response.data.data?.[0];
      if (!networkData) {
        return Left(new Error(`Network configuration not found for chain ID: ${chainId}`));
      }

      const descriptors = networkData.descriptors.reduce((acc, desc) => {
        acc[desc.device_model] = {
          descriptorType: desc.descriptor.type,
          descriptorVersion: desc.descriptor.version,
          data: desc.descriptor.data,
          signatures: desc.signatures,
        };
        return acc;
      }, {} as Record<string, NetworkConfiguration["descriptors"][string]>);

      const configuration: NetworkConfiguration = {
        id: networkData.id,
        descriptors,
        icons: networkData.icons,
      };

      return Right(configuration);
    } catch (error) {
      return Left(
        error instanceof Error
          ? error
          : new Error("Failed to fetch network configuration"),
      );
    }
  }
}