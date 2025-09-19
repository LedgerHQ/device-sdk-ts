import { DeviceModelId } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";

import { type PkiCertificateLoader } from "@/pki/domain/PkiCertificateLoader";
import { KeyId } from "@/pki/model/KeyId";
import { KeyUsage } from "@/pki/model/KeyUsage";
import { type PkiCertificate } from "@/pki/model/PkiCertificate";
import { type ProxyDataSource } from "@/proxy/data/HttpProxyDataSource";
import { ProxyContextFieldLoader } from "@/proxy/domain/ProxyContextFieldLoader";
import { type ProxyDelegateCall } from "@/proxy/model/ProxyDelegateCall";
import { ClearSignContextType } from "@/shared/model/ClearSignContext";

describe("ProxyContextFieldLoader", () => {
  const mockProxyDataSource: ProxyDataSource = {
    getProxyDelegateCall: vi.fn(),
    getProxyImplementationAddress: vi.fn(),
  };
  const mockCertificateLoader: PkiCertificateLoader = {
    loadCertificate: vi.fn(),
  };
  const proxyContextFieldLoader = new ProxyContextFieldLoader(
    mockProxyDataSource,
    mockCertificateLoader,
  );

  const mockTransactionField = {
    chainId: 1,
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
  });

  describe("canHandle", () => {
    it("should return true for valid proxy field", () => {
      // GIVEN
      const validField = {
        chainId: 1,
        proxyAddress: "0x1234567890abcdef",
        calldata: "0xabcdef1234567890",
        challenge: "test-challenge",
        deviceModelId: DeviceModelId.STAX,
      };

      // THEN
      expect(
        proxyContextFieldLoader.canHandle(
          validField,
          ClearSignContextType.PROXY_DELEGATE_CALL,
        ),
      ).toBe(true);
    });

    describe("should return false for invalid fields", () => {
      const invalidFields = [
        { name: "null", value: null },
        { name: "undefined", value: undefined },
        { name: "string", value: "invalid" },
        { name: "number", value: 123 },
        { name: "boolean", value: true },
        { name: "array", value: [] },
        { name: "empty object", value: {} },
        {
          name: "object missing chainId",
          value: {
            proxyAddress: "0x123",
            calldata: "0xabc",
            challenge: "test",
            deviceModelId: DeviceModelId.STAX,
          },
        },
        {
          name: "object missing proxyAddress",
          value: {
            chainId: 1,
            calldata: "0xabc",
            challenge: "test",
            deviceModelId: DeviceModelId.STAX,
          },
        },
        {
          name: "object missing calldata",
          value: {
            chainId: 1,
            proxyAddress: "0x123",
            challenge: "test",
            deviceModelId: DeviceModelId.STAX,
          },
        },
        {
          name: "object missing challenge",
          value: {
            chainId: 1,
            proxyAddress: "0x123",
            calldata: "0xabc",
            deviceModelId: DeviceModelId.STAX,
          },
        },
        {
          name: "object missing deviceModelId",
          value: {
            chainId: 1,
            proxyAddress: "0x123",
            calldata: "0xabc",
            challenge: "test",
          },
        },
      ];

      test.each(invalidFields)("$name", ({ value }) => {
        expect(
          proxyContextFieldLoader.canHandle(
            value,
            ClearSignContextType.PROXY_DELEGATE_CALL,
          ),
        ).toBe(false);
      });
    });

    it("should return false for invalid expected type", () => {
      expect(
        proxyContextFieldLoader.canHandle(
          mockTransactionField,
          ClearSignContextType.TOKEN,
        ),
      ).toBe(false);
    });
  });

  describe("loadField", () => {
    it("should return error context when proxy data source fails", async () => {
      // GIVEN
      const error = new Error("Proxy data source error");
      vi.spyOn(mockProxyDataSource, "getProxyDelegateCall").mockResolvedValue(
        Left(error),
      );

      // WHEN
      const result =
        await proxyContextFieldLoader.loadField(mockTransactionField);

      // THEN
      expect(mockProxyDataSource.getProxyDelegateCall).toHaveBeenCalledWith({
        calldata: mockTransactionField.calldata,
        proxyAddress: mockTransactionField.proxyAddress,
        chainId: mockTransactionField.chainId,
        challenge: mockTransactionField.challenge,
      });
      expect(result).toEqual({
        type: ClearSignContextType.ERROR,
        error: error,
      });
      expect(mockCertificateLoader.loadCertificate).not.toHaveBeenCalled();
    });

    it("should return proxy delegate call context when successful", async () => {
      // GIVEN
      vi.spyOn(mockProxyDataSource, "getProxyDelegateCall").mockResolvedValue(
        Right(mockProxyDelegateCall),
      );
      vi.spyOn(mockCertificateLoader, "loadCertificate").mockResolvedValue(
        mockCertificate,
      );

      // WHEN
      const result =
        await proxyContextFieldLoader.loadField(mockTransactionField);

      // THEN
      expect(mockProxyDataSource.getProxyDelegateCall).toHaveBeenCalledWith({
        calldata: mockTransactionField.calldata,
        proxyAddress: mockTransactionField.proxyAddress,
        chainId: mockTransactionField.chainId,
        challenge: mockTransactionField.challenge,
      });
      expect(mockCertificateLoader.loadCertificate).toHaveBeenCalledWith({
        keyId: KeyId.CalCalldataKey,
        keyUsage: KeyUsage.Calldata,
        targetDevice: mockTransactionField.deviceModelId,
      });
      expect(result).toEqual({
        type: ClearSignContextType.PROXY_DELEGATE_CALL,
        payload: mockProxyDelegateCall.signedDescriptor,
        certificate: mockCertificate,
      });
    });

    it("should return proxy delegate call context with undefined certificate when certificate loading returns undefined", async () => {
      // GIVEN
      vi.spyOn(mockProxyDataSource, "getProxyDelegateCall").mockResolvedValue(
        Right(mockProxyDelegateCall),
      );
      vi.spyOn(mockCertificateLoader, "loadCertificate").mockResolvedValue(
        undefined,
      );

      // WHEN
      const result =
        await proxyContextFieldLoader.loadField(mockTransactionField);

      // THEN
      expect(mockProxyDataSource.getProxyDelegateCall).toHaveBeenCalledWith({
        calldata: mockTransactionField.calldata,
        proxyAddress: mockTransactionField.proxyAddress,
        chainId: mockTransactionField.chainId,
        challenge: mockTransactionField.challenge,
      });
      expect(mockCertificateLoader.loadCertificate).toHaveBeenCalledWith({
        keyId: KeyId.CalCalldataKey,
        keyUsage: KeyUsage.Calldata,
        targetDevice: mockTransactionField.deviceModelId,
      });
      expect(result).toEqual({
        type: ClearSignContextType.PROXY_DELEGATE_CALL,
        payload: mockProxyDelegateCall.signedDescriptor,
        certificate: undefined,
      });
    });

    it("should handle different device model IDs correctly", async () => {
      // GIVEN
      const nanoXField = {
        ...mockTransactionField,
        deviceModelId: DeviceModelId.NANO_X,
      };
      vi.spyOn(mockProxyDataSource, "getProxyDelegateCall").mockResolvedValue(
        Right(mockProxyDelegateCall),
      );
      vi.spyOn(mockCertificateLoader, "loadCertificate").mockResolvedValue(
        mockCertificate,
      );

      // WHEN
      const result = await proxyContextFieldLoader.loadField(nanoXField);

      // THEN
      expect(mockCertificateLoader.loadCertificate).toHaveBeenCalledWith({
        keyId: KeyId.CalCalldataKey,
        keyUsage: KeyUsage.Calldata,
        targetDevice: DeviceModelId.NANO_X,
      });
      expect(result).toEqual({
        type: ClearSignContextType.PROXY_DELEGATE_CALL,
        payload: mockProxyDelegateCall.signedDescriptor,
        certificate: mockCertificate,
      });
    });

    it("should handle different chain IDs and addresses correctly", async () => {
      // GIVEN
      const customField = {
        ...mockTransactionField,
        chainId: 137,
        proxyAddress: "0xdeadbeef",
        calldata: "0xcafebabe",
        challenge: "custom-challenge",
      };
      vi.spyOn(mockProxyDataSource, "getProxyDelegateCall").mockResolvedValue(
        Right(mockProxyDelegateCall),
      );
      vi.spyOn(mockCertificateLoader, "loadCertificate").mockResolvedValue(
        mockCertificate,
      );

      // WHEN
      const result = await proxyContextFieldLoader.loadField(customField);

      // THEN
      expect(mockProxyDataSource.getProxyDelegateCall).toHaveBeenCalledWith({
        calldata: "0xcafebabe",
        proxyAddress: "0xdeadbeef",
        chainId: 137,
        challenge: "custom-challenge",
      });
      expect(result).toEqual({
        type: ClearSignContextType.PROXY_DELEGATE_CALL,
        payload: mockProxyDelegateCall.signedDescriptor,
        certificate: mockCertificate,
      });
    });

    it("should handle certificate loading failure gracefully", async () => {
      // GIVEN
      vi.spyOn(mockProxyDataSource, "getProxyDelegateCall").mockResolvedValue(
        Right(mockProxyDelegateCall),
      );
      vi.spyOn(mockCertificateLoader, "loadCertificate").mockRejectedValue(
        new Error("Certificate loading failed"),
      );

      // WHEN & THEN
      await expect(
        proxyContextFieldLoader.loadField(mockTransactionField),
      ).rejects.toThrow("Certificate loading failed");

      expect(mockProxyDataSource.getProxyDelegateCall).toHaveBeenCalled();
      expect(mockCertificateLoader.loadCertificate).toHaveBeenCalled();
    });

    it("should preserve error message from proxy data source", async () => {
      // GIVEN
      const specificError = new Error("Network timeout error");
      vi.spyOn(mockProxyDataSource, "getProxyDelegateCall").mockResolvedValue(
        Left(specificError),
      );

      // WHEN
      const result =
        await proxyContextFieldLoader.loadField(mockTransactionField);

      // THEN
      expect(result).toEqual({
        type: ClearSignContextType.ERROR,
        error: specificError,
      });
    });

    it("should handle empty signed descriptor", async () => {
      // GIVEN
      const proxyCallWithEmptyDescriptor = {
        ...mockProxyDelegateCall,
        signedDescriptor: "",
      };
      vi.spyOn(mockProxyDataSource, "getProxyDelegateCall").mockResolvedValue(
        Right(proxyCallWithEmptyDescriptor),
      );
      vi.spyOn(mockCertificateLoader, "loadCertificate").mockResolvedValue(
        mockCertificate,
      );

      // WHEN
      const result =
        await proxyContextFieldLoader.loadField(mockTransactionField);

      // THEN
      expect(result).toEqual({
        type: ClearSignContextType.PROXY_DELEGATE_CALL,
        payload: "",
        certificate: mockCertificate,
      });
    });
  });
});
