import { DeviceModelId } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";

import { type PkiCertificateLoader } from "@/pki/domain/PkiCertificateLoader";
import { KeyId } from "@/pki/model/KeyId";
import { KeyUsage } from "@/pki/model/KeyUsage";
import { type PkiCertificate } from "@/pki/model/PkiCertificate";
import { type ProxyDataSource } from "@/proxy/data/HttpProxyDataSource";
import { type ProxyFieldInput } from "@/proxy/domain/ProxyContextFieldLoader";
import { type ProxyDelegateCall } from "@/proxy/model/ProxyDelegateCall";
import { SupportedChainIds } from "@/safe/constant/SupportedChainIds";
import { SafeProxyContextFieldLoader } from "@/safe/domain/SafeProxyContextFieldLoader";
import { ContextFieldLoaderKind } from "@/shared/domain/ContextFieldLoader";
import { ClearSignContextType } from "@/shared/model/ClearSignContext";

describe("SafeProxyContextFieldLoader", () => {
  const mockProxyDataSource: ProxyDataSource = {
    getProxyDelegateCall: vi.fn(),
    getProxyImplementationAddress: vi.fn(),
  };
  const mockCertificateLoader: PkiCertificateLoader = {
    loadCertificate: vi.fn(),
  };

  let safeProxyContextFieldLoader: SafeProxyContextFieldLoader;

  const mockProxyField: ProxyFieldInput = {
    kind: ContextFieldLoaderKind.PROXY_DELEGATE_CALL,
    chainId: SupportedChainIds.BASE, // 8453
    proxyAddress: "0x1234567890abcdef",
    calldata: "0xabcdef1234567890",
    challenge: "test-challenge",
    deviceModelId: DeviceModelId.STAX,
  };

  const mockProxyDelegateCall: ProxyDelegateCall = {
    delegateAddresses: ["0x987654321fedcba0"],
    signedDescriptor: "0x123456789abcdef0",
  };

  const mockCertificate: PkiCertificate = {
    keyUsageNumber: 1,
    payload: new Uint8Array([1, 2, 3, 4]),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    safeProxyContextFieldLoader = new SafeProxyContextFieldLoader(
      mockProxyDataSource,
      mockCertificateLoader,
    );
  });

  describe("constructor", () => {
    it("should create instance with internal ProxyContextFieldLoader", () => {
      // WHEN
      const loader = new SafeProxyContextFieldLoader(
        mockProxyDataSource,
        mockCertificateLoader,
      );

      // THEN
      expect(loader).toBeInstanceOf(SafeProxyContextFieldLoader);
      expect(loader).toBeDefined();
    });
  });

  describe("canHandle", () => {
    it("should delegate to internal ProxyContextFieldLoader for valid field", () => {
      // GIVEN
      const validField = {
        kind: ContextFieldLoaderKind.PROXY_DELEGATE_CALL,
        chainId: 1,
        proxyAddress: "0x1234567890abcdef",
        calldata: "0xabcdef1234567890",
        challenge: "test-challenge",
        deviceModelId: DeviceModelId.STAX,
      };

      // WHEN
      const result = safeProxyContextFieldLoader.canHandle(validField);

      // THEN
      expect(result).toBe(true);
    });

    it("should delegate to internal ProxyContextFieldLoader for invalid field", () => {
      // GIVEN
      const invalidField = { invalid: "field" };

      // WHEN
      const result = safeProxyContextFieldLoader.canHandle(invalidField);

      // THEN
      expect(result).toBe(false);
    });

    it("should return false for null", () => {
      // WHEN
      const result = safeProxyContextFieldLoader.canHandle(null);

      // THEN
      expect(result).toBe(false);
    });
  });

  describe("loadField", () => {
    describe("supported chain IDs", () => {
      const supportedChainIds = [
        { name: "BASE", chainId: SupportedChainIds.BASE },
        { name: "OPTIMISM", chainId: SupportedChainIds.OPTIMISM },
        { name: "ARBITRUM", chainId: SupportedChainIds.ARBITRUM },
        { name: "POLYGON", chainId: SupportedChainIds.POLYGON },
      ];

      test.each(supportedChainIds)(
        "should delegate to internal loader for supported chain ID: $name ($chainId)",
        async ({ chainId }) => {
          // GIVEN
          const fieldWithSupportedChain = {
            ...mockProxyField,
            chainId,
          };
          vi.spyOn(
            mockProxyDataSource,
            "getProxyDelegateCall",
          ).mockResolvedValue(Right(mockProxyDelegateCall));
          vi.spyOn(mockCertificateLoader, "loadCertificate").mockResolvedValue(
            mockCertificate,
          );

          // WHEN
          const result = await safeProxyContextFieldLoader.loadField(
            fieldWithSupportedChain,
          );

          // THEN
          expect(mockProxyDataSource.getProxyDelegateCall).toHaveBeenCalledWith(
            {
              calldata: fieldWithSupportedChain.calldata,
              proxyAddress: fieldWithSupportedChain.proxyAddress,
              chainId: fieldWithSupportedChain.chainId,
              challenge: fieldWithSupportedChain.challenge,
            },
          );
          expect(mockCertificateLoader.loadCertificate).toHaveBeenCalledWith({
            keyId: KeyId.CalCalldataKey,
            keyUsage: KeyUsage.Calldata,
            targetDevice: fieldWithSupportedChain.deviceModelId,
          });
          expect(result).toEqual({
            type: ClearSignContextType.PROXY_DELEGATE_CALL,
            payload: mockProxyDelegateCall.signedDescriptor,
            certificate: mockCertificate,
          });
        },
      );
    });

    describe("unsupported chain IDs", () => {
      const unsupportedChainIds = [
        { name: "Ethereum Mainnet", chainId: 1 },
        { name: "Binance Smart Chain", chainId: 56 },
        { name: "Avalanche", chainId: 43114 },
        { name: "Random chain", chainId: 999999 },
      ];

      test.each(unsupportedChainIds)(
        "should return error for unsupported chain ID: $name ($chainId)",
        async ({ chainId }) => {
          // GIVEN
          const fieldWithUnsupportedChain = {
            ...mockProxyField,
            chainId,
          };

          // WHEN
          const result = await safeProxyContextFieldLoader.loadField(
            fieldWithUnsupportedChain,
          );

          // THEN
          expect(result).toEqual({
            type: ClearSignContextType.ERROR,
            error: new Error("Invalid chain id"),
          });
          expect(
            mockProxyDataSource.getProxyDelegateCall,
          ).not.toHaveBeenCalled();
          expect(mockCertificateLoader.loadCertificate).not.toHaveBeenCalled();
        },
      );
    });

    it("should return error from internal loader when proxy data source fails", async () => {
      // GIVEN
      const error = new Error("Proxy data source error");
      vi.spyOn(mockProxyDataSource, "getProxyDelegateCall").mockResolvedValue(
        Left(error),
      );

      // WHEN
      const result =
        await safeProxyContextFieldLoader.loadField(mockProxyField);

      // THEN
      expect(result).toEqual({
        type: ClearSignContextType.ERROR,
        error: error,
      });
      expect(mockCertificateLoader.loadCertificate).not.toHaveBeenCalled();
    });

    it("should handle certificate loading failure from internal loader", async () => {
      // GIVEN
      vi.spyOn(mockProxyDataSource, "getProxyDelegateCall").mockResolvedValue(
        Right(mockProxyDelegateCall),
      );
      vi.spyOn(mockCertificateLoader, "loadCertificate").mockRejectedValue(
        new Error("Certificate loading failed"),
      );

      // WHEN & THEN
      await expect(
        safeProxyContextFieldLoader.loadField(mockProxyField),
      ).rejects.toThrow("Certificate loading failed");

      expect(mockProxyDataSource.getProxyDelegateCall).toHaveBeenCalled();
      expect(mockCertificateLoader.loadCertificate).toHaveBeenCalled();
    });
  });
});
