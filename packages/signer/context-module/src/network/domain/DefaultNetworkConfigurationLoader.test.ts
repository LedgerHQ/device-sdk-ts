import { Left, Right } from "purify-ts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { type NetworkDataSource } from "@/network/data/NetworkDataSource";

import { DefaultNetworkConfigurationLoader } from "./DefaultNetworkConfigurationLoader";
import { type NetworkConfiguration } from "./NetworkConfigurationLoader";

describe("DefaultNetworkConfigurationLoader", () => {
  let loader: DefaultNetworkConfigurationLoader;
  let mockDataSource: NetworkDataSource;

  const mockNetworkConfiguration: NetworkConfiguration = {
    id: "ethereum",
    descriptors: {
      flex: {
        descriptorType: "network",
        descriptorVersion: "v1",
        data: "0x010108020101510101230800000000000000895207506f6c79676f6e2403504f4c",
        signatures: {
          prod: "prod-signature",
          test: "test-signature",
        },
        icon: "https://example.com/flex-icon.svg",
      },
      stax: {
        descriptorType: "network",
        descriptorVersion: "v1",
        data: "0x010108020101510101230800000000000000895207506f6c79676f6e2403504f4c53204aa5034d2fd4c46647d382aa64d0a03d06b185512bb7942390318bda18d0423a",
        signatures: {
          prod: "prod-signature",
          test: "test-signature",
        },
        icon: "https://example.com/stax-icon.svg",
      },
    },
  };

  beforeEach(() => {
    mockDataSource = {
      getNetworkConfiguration: vi.fn(),
    };
    loader = new DefaultNetworkConfigurationLoader(mockDataSource);
  });

  describe("load", () => {
    it("should return network configuration when data source returns success", async () => {
      vi.mocked(mockDataSource.getNetworkConfiguration).mockResolvedValue(
        Right(mockNetworkConfiguration),
      );

      const result = await loader.load(1);

      expect(mockDataSource.getNetworkConfiguration).toHaveBeenCalledWith(1);
      expect(result).toEqual(mockNetworkConfiguration);
    });

    it("should return null when data source returns error", async () => {
      vi.mocked(mockDataSource.getNetworkConfiguration).mockResolvedValue(
        Left(new Error("Network not found")),
      );

      const result = await loader.load(999);

      expect(mockDataSource.getNetworkConfiguration).toHaveBeenCalledWith(999);
      expect(result).toBeNull();
    });

    it("should pass through different chain IDs correctly", async () => {
      vi.mocked(mockDataSource.getNetworkConfiguration).mockResolvedValue(
        Right(mockNetworkConfiguration),
      );

      await loader.load(137); // Polygon
      expect(mockDataSource.getNetworkConfiguration).toHaveBeenCalledWith(137);

      await loader.load(10); // Optimism
      expect(mockDataSource.getNetworkConfiguration).toHaveBeenCalledWith(10);

      await loader.load(42161); // Arbitrum
      expect(mockDataSource.getNetworkConfiguration).toHaveBeenCalledWith(
        42161,
      );
    });

    it("should handle empty descriptors", async () => {
      const emptyConfig: NetworkConfiguration = {
        id: "test-network",
        descriptors: {},
      };
      vi.mocked(mockDataSource.getNetworkConfiguration).mockResolvedValue(
        Right(emptyConfig),
      );

      const result = await loader.load(1);

      expect(result).toEqual(emptyConfig);
    });

    it("should handle network configuration with no icons", async () => {
      const configWithoutIcons: NetworkConfiguration = {
        id: "ethereum",
        descriptors: {
          flex: {
            descriptorType: "network",
            descriptorVersion: "v1",
            data: "0x123",
            signatures: {
              prod: "prod-sig",
              test: "test-sig",
            },
            icon: undefined,
          },
        },
      };
      vi.mocked(mockDataSource.getNetworkConfiguration).mockResolvedValue(
        Right(configWithoutIcons),
      );

      const result = await loader.load(1);

      expect(result).toEqual(configWithoutIcons);
    });

    it("should handle data source throwing error", async () => {
      vi.mocked(mockDataSource.getNetworkConfiguration).mockRejectedValue(
        new Error("Network error"),
      );

      await expect(loader.load(1)).rejects.toThrow("Network error");
    });
  });
});
