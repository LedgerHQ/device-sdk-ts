import { type AxiosInstance } from "axios";
import { injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import { type NetworkConfiguration } from "@/network/domain/NetworkConfigurationLoader";

import { type NetworkDataSource } from "./NetworkDataSource";

type NetworkApiResponse = {
  data: Array<{
    id: string;
    descriptors: Record<string, {
      data: string;
      descriptorType: string;
      descriptorVersion: string;
      signatures: {
        prod: string;
        test: string;
      };
    }>;
    icons: Record<string, string>;
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

      // Validate response structure
      if (!this.isValidNetworkData(networkData)) {
        return Left(new Error(`Invalid network configuration response for chain ID: ${chainId}`));
      }

      const descriptors = Object.entries(networkData.descriptors).reduce((acc, [deviceModel, descriptor]) => {
        acc[deviceModel] = {
          descriptorType: descriptor.descriptorType,
          descriptorVersion: descriptor.descriptorVersion,
          data: descriptor.data,
          signatures: descriptor.signatures,
          icon: networkData.icons?.[deviceModel],
        };
        return acc;
      }, {} as Record<string, NetworkConfiguration["descriptors"][string]>);

      const configuration: NetworkConfiguration = {
        id: networkData.id,
        descriptors,
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

  private isValidNetworkData(data: unknown): data is NetworkApiResponse['data'][0] {
    if (!data || typeof data !== 'object') {
      return false;
    }

    const obj = data as Record<string, unknown>;

    // Check required fields
    if (typeof obj.id !== 'string') {
      return false;
    }

    // Check descriptors structure
    if (!obj.descriptors || typeof obj.descriptors !== 'object') {
      return false;
    }

    // Validate each descriptor
    for (const descriptor of Object.values(obj.descriptors)) {
      if (!this.isValidDescriptor(descriptor)) {
        return false;
      }
    }

    // Icons are optional but if present, should be an object
    if (obj.icons && typeof obj.icons !== 'object') {
      return false;
    }

    return true;
  }

  private isValidDescriptor(descriptor: unknown): descriptor is NetworkApiResponse['data'][0]['descriptors'][string] {
    if (!descriptor || typeof descriptor !== 'object') {
      return false;
    }

    const desc = descriptor as Record<string, unknown>;

    // Check required descriptor fields
    if (
      typeof desc.data !== 'string' ||
      typeof desc.descriptorType !== 'string' ||
      typeof desc.descriptorVersion !== 'string'
    ) {
      return false;
    }

    // Check signatures structure
    if (!desc.signatures || typeof desc.signatures !== 'object') {
      return false;
    }

    const signatures = desc.signatures as Record<string, unknown>;
    if (typeof signatures.prod !== 'string' || typeof signatures.test !== 'string') {
      return false;
    }

    return true;
  }
}