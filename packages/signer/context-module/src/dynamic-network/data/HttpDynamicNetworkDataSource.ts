import axios from "axios";
import { inject, injectable } from "inversify";
import { Either, Left, Right } from "purify-ts";

import { configTypes } from "@/config/di/configTypes";
import { type ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import {
  type DynamicNetworkConfiguration,
  type DynamicNetworkDescriptor,
  type LowercaseDeviceModelId,
} from "@/dynamic-network/model/DynamicNetworkConfiguration";
import { LEDGER_CLIENT_VERSION_HEADER } from "@/shared/constant/HttpHeaders";
import PACKAGE from "@root/package.json";

import { type DynamicNetworkApiResponseDto } from "./dto/DynamicNetworkApiResponseDto";
import { type DynamicNetworkDataSource } from "./DynamicNetworkDataSource";

@injectable()
export class HttpDynamicNetworkDataSource implements DynamicNetworkDataSource {
  constructor(
    @inject(configTypes.Config) private readonly config: ContextModuleConfig,
  ) {}

  async getDynamicNetworkConfiguration(
    chainId: number,
  ): Promise<Either<Error, DynamicNetworkConfiguration>> {
    let response: DynamicNetworkApiResponseDto;

    try {
      const axiosResponse = await axios.get<DynamicNetworkApiResponseDto>(
        `${this.config.cal.url}/networks?output=id,descriptors,icons&chain_id=${chainId}`,
        {
          headers: {
            [LEDGER_CLIENT_VERSION_HEADER]: `context-module/${PACKAGE.version}`,
          },
        },
      );
      response = axiosResponse.data;
    } catch (error) {
      return Left(
        error instanceof Error
          ? error
          : new Error("Failed to fetch network configuration"),
      );
    }

    const networkData = response?.[0];
    if (!networkData) {
      return Left(
        new Error(`Network configuration not found for chain ID: ${chainId}`),
      );
    }

    // Validate response structure
    if (!this.isValidNetworkData(networkData)) {
      return Left(
        new Error(
          `Invalid network configuration response for chain ID: ${chainId}`,
        ),
      );
    }

    const configuration = this.transformToNetworkConfiguration(networkData);
    return Right(configuration);
  }

  private isValidNetworkData(
    data: unknown,
  ): data is DynamicNetworkApiResponseDto[0] {
    if (!data || typeof data !== "object") {
      return false;
    }

    const obj = data as Record<string, unknown>;

    // Check required fields
    if (typeof obj["id"] !== "string") {
      return false;
    }

    // Check descriptors structure
    if (!obj["descriptors"] || typeof obj["descriptors"] !== "object") {
      return false;
    }

    // Validate each descriptor
    for (const descriptor of Object.values(obj["descriptors"])) {
      if (!this.isValidDescriptor(descriptor)) {
        return false;
      }
    }

    // Icons are optional but if present, should be an object
    if (obj["icons"] && typeof obj["icons"] !== "object") {
      return false;
    }

    return true;
  }

  private isValidDescriptor(
    descriptor: unknown,
  ): descriptor is DynamicNetworkApiResponseDto[0]["descriptors"][string] {
    if (!descriptor || typeof descriptor !== "object") {
      return false;
    }

    const desc = descriptor as Record<string, unknown>;

    // Check required descriptor fields
    if (
      typeof desc["data"] !== "string" ||
      typeof desc["descriptorType"] !== "string" ||
      typeof desc["descriptorVersion"] !== "string"
    ) {
      return false;
    }

    // Check signatures structure
    if (!desc["signatures"] || typeof desc["signatures"] !== "object") {
      return false;
    }

    const signatures = desc["signatures"] as Record<string, unknown>;
    if (
      typeof signatures["prod"] !== "string" ||
      typeof signatures["test"] !== "string"
    ) {
      return false;
    }

    return true;
  }

  private transformToNetworkConfiguration(
    networkData: DynamicNetworkApiResponseDto[0],
  ): DynamicNetworkConfiguration {
    const descriptors = Object.entries(networkData.descriptors).reduce(
      (acc, [deviceModel, descriptor]) => {
        acc[deviceModel as LowercaseDeviceModelId] = {
          descriptorType: descriptor.descriptorType,
          descriptorVersion: descriptor.descriptorVersion,
          data: descriptor.data,
          signatures: descriptor.signatures,
          icon: networkData.icons?.[deviceModel],
        };
        return acc;
      },
      {} as Record<LowercaseDeviceModelId, DynamicNetworkDescriptor>,
    );

    return {
      id: networkData.id,
      descriptors,
    };
  }
}
