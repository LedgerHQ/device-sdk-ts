import { DeviceModelId } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";

import { type ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import { type DynamicNetworkDataSource } from "@/dynamic-network/data/DynamicNetworkDataSource";
import {
  type DynamicNetworkContextInput,
  DynamicNetworkContextLoader,
} from "@/dynamic-network/domain/DynamicNetworkContextLoader";
import {
  type DynamicNetworkConfiguration,
  type DynamicNetworkDescriptor,
} from "@/dynamic-network/model/DynamicNetworkConfiguration";
import { type PkiCertificateLoader } from "@/pki/domain/PkiCertificateLoader";
import { KeyId } from "@/pki/model/KeyId";
import { KeyUsage } from "@/pki/model/KeyUsage";
import { type PkiCertificate } from "@/pki/model/PkiCertificate";
import { ClearSignContextType } from "@/shared/model/ClearSignContext";
import { NullLoggerPublisherService } from "@/shared/utils/NullLoggerPublisherService";

describe("DynamicNetworkContextLoader", () => {
  const mockNetworkDataSource: DynamicNetworkDataSource = {
    getDynamicNetworkConfiguration: vi.fn(),
  };

  const mockConfig = {
    cal: {
      url: "https://crypto-assets-service.api.ledger.com",
      mode: "prod",
      branch: "main",
    },
  } as ContextModuleConfig;

  const mockCertificateLoader: PkiCertificateLoader = {
    loadCertificate: vi.fn(),
  };

  const mockCertificate: PkiCertificate = {
    keyUsageNumber: 1,
    payload: new Uint8Array([0x01, 0x02, 0x03]),
  };

  const loader = new DynamicNetworkContextLoader(
    mockNetworkDataSource,
    mockConfig,
    mockCertificateLoader,
    NullLoggerPublisherService,
  );

  // Helper function to create a mock NetworkDescriptor
  const createMockDescriptor = (
    partial?: Partial<DynamicNetworkDescriptor>,
  ): DynamicNetworkDescriptor => ({
    data: "",
    descriptorType: "",
    descriptorVersion: "",
    signatures: {
      prod: "",
      test: "",
    },
    icon: undefined,
    ...partial,
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(mockCertificateLoader, "loadCertificate").mockResolvedValue(
      mockCertificate,
    );
  });

  describe("canHandle function", () => {
    const validInput: DynamicNetworkContextInput = {
      chainId: 1,
      deviceModelId: DeviceModelId.STAX,
    };

    it("should return true for valid input", () => {
      expect(
        loader.canHandle(validInput, [
          ClearSignContextType.DYNAMIC_NETWORK,
          ClearSignContextType.DYNAMIC_NETWORK_ICON,
        ]),
      ).toBe(true);
    });

    it("should return false for invalid expected type", () => {
      expect(loader.canHandle(validInput, [ClearSignContextType.TOKEN])).toBe(
        false,
      );
      expect(
        loader.canHandle(validInput, [ClearSignContextType.DYNAMIC_NETWORK]),
      ).toBe(false);
      expect(
        loader.canHandle(validInput, [
          ClearSignContextType.DYNAMIC_NETWORK_ICON,
        ]),
      ).toBe(false);
    });

    it.each([
      [null, "null input"],
      [undefined, "undefined input"],
      [{}, "empty object"],
      ["string", "string input"],
      [123, "number input"],
    ])("should return false for %s", (input, _description) => {
      expect(
        loader.canHandle(input, [
          ClearSignContextType.DYNAMIC_NETWORK,
          ClearSignContextType.DYNAMIC_NETWORK_ICON,
        ]),
      ).toBe(false);
    });

    it.each([
      [{ ...validInput, chainId: undefined }, "missing chainId"],
      [{ ...validInput, deviceModelId: undefined }, "missing deviceModelId"],
    ])("should return false for %s", (input, _description) => {
      expect(
        loader.canHandle(input, [
          ClearSignContextType.DYNAMIC_NETWORK,
          ClearSignContextType.DYNAMIC_NETWORK_ICON,
        ]),
      ).toBe(false);
    });

    it.each([
      [{ ...validInput, chainId: "1" }, "string chainId"],
      [{ ...validInput, chainId: null }, "null chainId"],
      [
        { ...validInput, deviceModelId: DeviceModelId.NANO_S },
        "NANO_S deviceModelId",
      ],
    ])("should return false for %s", (input, _description) => {
      expect(
        loader.canHandle(input, [
          ClearSignContextType.DYNAMIC_NETWORK,
          ClearSignContextType.DYNAMIC_NETWORK_ICON,
        ]),
      ).toBe(false);
    });
  });

  describe("load function", () => {
    it("should return empty array when network data source returns error", async () => {
      // GIVEN
      const input: DynamicNetworkContextInput = {
        chainId: 1,
        deviceModelId: DeviceModelId.STAX,
      };
      vi.spyOn(
        mockNetworkDataSource,
        "getDynamicNetworkConfiguration",
      ).mockResolvedValue(Left(new Error("Network error")));

      // WHEN
      const result = await loader.load(input);

      // THEN
      expect(result).toEqual([]);
      expect(
        mockNetworkDataSource.getDynamicNetworkConfiguration,
      ).toHaveBeenCalledWith(1);
    });

    it("should return empty array when descriptor for device model is not found", async () => {
      // GIVEN
      const input: DynamicNetworkContextInput = {
        chainId: 1,
        deviceModelId: DeviceModelId.STAX,
      };
      const networkConfig: DynamicNetworkConfiguration = {
        id: "ethereum",
        descriptors: {
          [DeviceModelId.NANO_S]: createMockDescriptor(),
          [DeviceModelId.NANO_SP]: createMockDescriptor(),
          [DeviceModelId.NANO_X]: createMockDescriptor(),
          // STAX descriptor is intentionally missing
          [DeviceModelId.FLEX]: createMockDescriptor({
            data: "0x0101",
            descriptorType: "network",
            descriptorVersion: "v1",
            signatures: {
              prod: "prod-sig",
              test: "test-sig",
            },
            icon: undefined,
          }),
        } as Record<DeviceModelId, DynamicNetworkDescriptor>,
      };
      vi.spyOn(
        mockNetworkDataSource,
        "getDynamicNetworkConfiguration",
      ).mockResolvedValue(Right(networkConfig));

      // WHEN
      const result = await loader.load(input);

      // THEN
      expect(result).toEqual([]);
    });

    it("should return empty array when signature for mode is not found", async () => {
      // GIVEN
      const input: DynamicNetworkContextInput = {
        chainId: 1,
        deviceModelId: DeviceModelId.STAX,
      };
      const networkConfig: DynamicNetworkConfiguration = {
        id: "ethereum",
        descriptors: {
          [DeviceModelId.APEX]: createMockDescriptor(),
          [DeviceModelId.NANO_S]: createMockDescriptor(),
          [DeviceModelId.NANO_SP]: createMockDescriptor(),
          [DeviceModelId.NANO_X]: createMockDescriptor(),
          [DeviceModelId.FLEX]: createMockDescriptor(),
          [DeviceModelId.STAX]: createMockDescriptor({
            data: "0x0101",
            descriptorType: "network",
            descriptorVersion: "v1",
            signatures: {
              test: "test-sig",
              // Missing prod signature - intentionally partial
            } as { prod: string; test: string },
            icon: undefined,
          }),
        },
      };
      vi.spyOn(
        mockNetworkDataSource,
        "getDynamicNetworkConfiguration",
      ).mockResolvedValue(Right(networkConfig));

      // WHEN
      const result = await loader.load(input);

      // THEN
      expect(result).toEqual([]);
    });

    it("should return context with network configuration when all data is available", async () => {
      // GIVEN
      const input: DynamicNetworkContextInput = {
        chainId: 137,
        deviceModelId: DeviceModelId.STAX,
      };
      const networkConfig: DynamicNetworkConfiguration = {
        id: "polygon",
        descriptors: {
          [DeviceModelId.APEX]: createMockDescriptor(),
          [DeviceModelId.NANO_S]: createMockDescriptor(),
          [DeviceModelId.NANO_SP]: createMockDescriptor(),
          [DeviceModelId.NANO_X]: createMockDescriptor(),
          [DeviceModelId.FLEX]: createMockDescriptor(),
          [DeviceModelId.STAX]: {
            data: "0x0101080201015101012308000000000000008952",
            descriptorType: "network",
            descriptorVersion: "v1",
            signatures: {
              prod: "3045022100cf42c039c16fc95dc97c09f15cdd93bed0e63ee45cf5c38c2b30bb8a3bc17f8d022053a96c9e51695c3c1c1a31f5cbf84bd6febadc97f4bb02bdc67cf3e24ad0c32d",
              test: "test-sig",
            },
            icon: undefined,
          },
        },
      };
      vi.spyOn(
        mockNetworkDataSource,
        "getDynamicNetworkConfiguration",
      ).mockResolvedValue(Right(networkConfig));

      // WHEN
      const result = await loader.load(input);

      // THEN
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: ClearSignContextType.DYNAMIC_NETWORK,
        payload: expect.stringContaining(
          "0x0101080201015101012308000000000000008952",
        ),
        certificate: mockCertificate,
      });
      expect(mockCertificateLoader.loadCertificate).toHaveBeenCalledWith({
        keyId: KeyId.CalNetwork,
        keyUsage: KeyUsage.Network,
        targetDevice: DeviceModelId.STAX,
      });
    });

    it("should include icon context when icon is available", async () => {
      // GIVEN
      const input: DynamicNetworkContextInput = {
        chainId: 1,
        deviceModelId: DeviceModelId.STAX,
      };
      const networkConfig: DynamicNetworkConfiguration = {
        id: "ethereum",
        descriptors: {
          [DeviceModelId.APEX]: createMockDescriptor(),
          [DeviceModelId.NANO_S]: createMockDescriptor(),
          [DeviceModelId.NANO_SP]: createMockDescriptor(),
          [DeviceModelId.NANO_X]: createMockDescriptor(),
          [DeviceModelId.FLEX]: createMockDescriptor(),
          [DeviceModelId.STAX]: {
            data: "0x0101",
            descriptorType: "network",
            descriptorVersion: "v1",
            signatures: {
              prod: "prod-sig",
              test: "test-sig",
            },
            icon: "icon-hex-data",
          },
        },
      };
      vi.spyOn(
        mockNetworkDataSource,
        "getDynamicNetworkConfiguration",
      ).mockResolvedValue(Right(networkConfig));

      // WHEN
      const result = await loader.load(input);

      // THEN
      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        type: ClearSignContextType.DYNAMIC_NETWORK,
        payload: expect.any(String),
        certificate: mockCertificate,
      });
      expect(result[1]).toMatchObject({
        type: ClearSignContextType.DYNAMIC_NETWORK_ICON,
        payload: "icon-hex-data",
      });
    });

    it("should handle multiple device models correctly", async () => {
      // GIVEN
      const input: DynamicNetworkContextInput = {
        chainId: 1,
        deviceModelId: DeviceModelId.FLEX,
      };
      const networkConfig: DynamicNetworkConfiguration = {
        id: "ethereum",
        descriptors: {
          [DeviceModelId.APEX]: createMockDescriptor(),
          [DeviceModelId.NANO_S]: createMockDescriptor(),
          [DeviceModelId.NANO_SP]: createMockDescriptor(),
          [DeviceModelId.NANO_X]: createMockDescriptor(),
          [DeviceModelId.FLEX]: {
            data: "0xFLEX",
            descriptorType: "network",
            descriptorVersion: "v1",
            signatures: {
              prod: "flex-prod-sig",
              test: "flex-test-sig",
            },
            icon: undefined,
          },
          [DeviceModelId.STAX]: {
            data: "0xSTAX",
            descriptorType: "network",
            descriptorVersion: "v1",
            signatures: {
              prod: "stax-prod-sig",
              test: "stax-test-sig",
            },
            icon: undefined,
          },
        },
      };
      vi.spyOn(
        mockNetworkDataSource,
        "getDynamicNetworkConfiguration",
      ).mockResolvedValue(Right(networkConfig));

      // WHEN
      const result = await loader.load(input);

      // THEN
      expect(result).toHaveLength(1);
      const context = result[0];
      if (context && "payload" in context) {
        expect(context.payload).toContain("0xFLEX");
        expect(context.payload).toContain("flex-prod-sig");
      }
    });

    it("should use test mode signature when configured", async () => {
      // GIVEN
      const testModeLoader = new DynamicNetworkContextLoader(
        mockNetworkDataSource,
        { ...mockConfig, cal: { ...mockConfig.cal, mode: "test" } },
        mockCertificateLoader,
        NullLoggerPublisherService,
      );
      const input: DynamicNetworkContextInput = {
        chainId: 1,
        deviceModelId: DeviceModelId.STAX,
      };
      const networkConfig: DynamicNetworkConfiguration = {
        id: "ethereum",
        descriptors: {
          [DeviceModelId.APEX]: createMockDescriptor(),
          [DeviceModelId.NANO_S]: createMockDescriptor(),
          [DeviceModelId.NANO_SP]: createMockDescriptor(),
          [DeviceModelId.NANO_X]: createMockDescriptor(),
          [DeviceModelId.FLEX]: createMockDescriptor(),
          [DeviceModelId.STAX]: {
            data: "0x0101",
            descriptorType: "network",
            descriptorVersion: "v1",
            signatures: {
              prod: "prod-sig",
              test: "test-sig",
            },
            icon: undefined,
          },
        },
      };
      vi.spyOn(
        mockNetworkDataSource,
        "getDynamicNetworkConfiguration",
      ).mockResolvedValue(Right(networkConfig));

      // WHEN
      const result = await testModeLoader.load(input);

      // THEN
      expect(result).toHaveLength(1);
      const context = result[0];
      if (context && "payload" in context) {
        expect(context.payload).toContain("test-sig");
      }
    });
  });
});
