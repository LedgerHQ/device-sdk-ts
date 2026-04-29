import { DeviceModelId } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";

import { type GatedDescriptorDataSource } from "@/gated-signing/data/GatedDescriptorDataSource";
import {
  type GatedSigningTypedDataContextInput,
  GatedSigningTypedDataContextLoader,
} from "@/gated-signing/domain/GatedSigningTypedDataContextLoader";
import { type PkiCertificateLoader } from "@/pki/domain/PkiCertificateLoader";
import { KeyId } from "@/pki/model/KeyId";
import { KeyUsage } from "@/pki/model/KeyUsage";
import { type PkiCertificate } from "@/pki/model/PkiCertificate";
import type { ProxyDataSource } from "@/proxy/data/ProxyDataSource";
import { ClearSignContextType } from "@/shared/model/ClearSignContext";

describe("GatedSigningTypedDataContextLoader", () => {
  const mockGatedDescriptorDataSource: GatedDescriptorDataSource = {
    getGatedDescriptor: vi.fn(),
    getGatedDescriptorForTypedData: vi.fn(),
  };

  const mockCertificateLoader: PkiCertificateLoader = {
    loadCertificate: vi.fn(),
  };

  const mockProxyDataSource: ProxyDataSource = {
    getProxyImplementationAddress: vi.fn(),
  };

  const loader = new GatedSigningTypedDataContextLoader(
    mockGatedDescriptorDataSource,
    mockCertificateLoader,
    mockProxyDataSource,
  );

  const mockCertificate: PkiCertificate = {
    keyUsageNumber: 1,
    payload: new Uint8Array([0x01, 0x02, 0x03]),
  };

  const SUPPORTED_TYPES: ClearSignContextType[] = [
    ClearSignContextType.GATED_SIGNING,
  ];

  const validInput: GatedSigningTypedDataContextInput = {
    data: {
      types: {
        EIP712Domain: [
          { name: "name", type: "string" },
          { name: "chainId", type: "uint256" },
        ],
        Mail: [{ name: "subject", type: "string" }],
      },
      domain: {
        verifyingContract: "0x1111111254fb6c44bac0bed2854e76f90643097d",
      },
    },
    chainId: 1,
    deviceModelId: DeviceModelId.STAX,
    challenge: "test-challenge",
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(mockCertificateLoader, "loadCertificate").mockResolvedValue(
      mockCertificate,
    );
  });

  describe("canHandle", () => {
    it("should return true for valid typed data input", () => {
      expect(loader.canHandle(validInput, SUPPORTED_TYPES)).toBe(true);
    });

    it("should return false when expected types do not include GATED_SIGNING", () => {
      expect(loader.canHandle(validInput, [ClearSignContextType.TOKEN])).toBe(
        false,
      );
      expect(
        loader.canHandle(validInput, [ClearSignContextType.DYNAMIC_NETWORK]),
      ).toBe(false);
    });

    it.each([
      [null, "null input"],
      [undefined, "undefined input"],
      [{}, "empty object"],
      ["string", "string input"],
    ])("should return false for %s", (input, _description) => {
      expect(loader.canHandle(input, SUPPORTED_TYPES)).toBe(false);
    });

    it("should return false for transaction-style input (selector, to)", () => {
      const transactionInput = {
        to: "0x1111111254fb6c44bac0bed2854e76f90643097d",
        selector: "0xa1251d75",
        chainId: 1,
        deviceModelId: DeviceModelId.STAX,
      };
      expect(loader.canHandle(transactionInput, SUPPORTED_TYPES)).toBe(false);
    });

    it("should return false when data is missing", () => {
      expect(
        loader.canHandle(
          { chainId: 1, deviceModelId: DeviceModelId.STAX },
          SUPPORTED_TYPES,
        ),
      ).toBe(false);
    });

    it("should return false when data.types is not a valid schema", () => {
      expect(
        loader.canHandle(
          {
            data: { types: "not-an-object" },
            chainId: 1,
            deviceModelId: DeviceModelId.STAX,
            challenge: validInput.challenge,
          },
          SUPPORTED_TYPES,
        ),
      ).toBe(false);
      expect(
        loader.canHandle(
          {
            data: { types: {} },
            chainId: 1,
            deviceModelId: DeviceModelId.STAX,
            challenge: validInput.challenge,
          },
          SUPPORTED_TYPES,
        ),
      ).toBe(true);
    });

    it("should return false when chainId or deviceModelId is missing", () => {
      expect(
        loader.canHandle(
          {
            data: validInput.data,
            deviceModelId: DeviceModelId.STAX,
            challenge: validInput.challenge,
          },
          SUPPORTED_TYPES,
        ),
      ).toBe(false);
      expect(
        loader.canHandle(
          {
            data: validInput.data,
            chainId: 1,
            challenge: validInput.challenge,
          },
          SUPPORTED_TYPES,
        ),
      ).toBe(false);
    });

    it("should return false when challenge is missing", () => {
      expect(
        loader.canHandle(
          {
            data: validInput.data,
            chainId: 1,
            deviceModelId: DeviceModelId.STAX,
          },
          SUPPORTED_TYPES,
        ),
      ).toBe(false);
    });
  });

  describe("load", () => {
    const signedDescriptor =
      "010122020101222a30783131313131313235346662366334346261633062656432383534653736663930363433303937642308000000000000000140086131323531643735150100";

    it("should return error context when getGatedDescriptorForTypedData returns Left and proxy resolution fails", async () => {
      const error = new Error("No gated descriptor for schema hash");
      vi.spyOn(
        mockGatedDescriptorDataSource,
        "getGatedDescriptorForTypedData",
      ).mockResolvedValue(Left(error));
      vi.spyOn(
        mockProxyDataSource,
        "getProxyImplementationAddress",
      ).mockResolvedValue(Left(new Error("Not a proxy")));

      const result = await loader.load(validInput);

      expect(result).toEqual([
        {
          type: ClearSignContextType.ERROR,
          error,
        },
      ]);
      expect(
        mockGatedDescriptorDataSource.getGatedDescriptorForTypedData,
      ).toHaveBeenCalledWith({
        contractAddress:
          validInput.data.domain!.verifyingContract!.toLowerCase(),
        schemaHash: expect.any(String),
        chainId: validInput.chainId,
      });
      expect(
        mockProxyDataSource.getProxyImplementationAddress,
      ).toHaveBeenCalledWith({
        proxyAddress: validInput.data.domain!.verifyingContract!.toLowerCase(),
        chainId: validInput.chainId,
        challenge: validInput.challenge,
        calldata: "0x",
      });
      expect(mockCertificateLoader.loadCertificate).not.toHaveBeenCalled();
    });

    it("should return gated signing context when getGatedDescriptorForTypedData succeeds", async () => {
      vi.spyOn(
        mockGatedDescriptorDataSource,
        "getGatedDescriptorForTypedData",
      ).mockResolvedValue(Right({ signedDescriptor }));

      const result = await loader.load(validInput);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: ClearSignContextType.GATED_SIGNING,
        payload: signedDescriptor,
        certificate: mockCertificate,
      });
      expect(
        mockGatedDescriptorDataSource.getGatedDescriptorForTypedData,
      ).toHaveBeenCalledWith({
        contractAddress:
          validInput.data.domain!.verifyingContract!.toLowerCase(),
        schemaHash: expect.any(String),
        chainId: validInput.chainId,
      });
      expect(mockCertificateLoader.loadCertificate).toHaveBeenCalledWith({
        keyId: KeyId.CalGatedSigning,
        keyUsage: KeyUsage.GatedSigning,
        targetDevice: validInput.deviceModelId,
      });
    });

    it("should use zero address when domain.verifyingContract is missing", async () => {
      vi.spyOn(
        mockGatedDescriptorDataSource,
        "getGatedDescriptorForTypedData",
      ).mockResolvedValue(Right({ signedDescriptor }));

      await loader.load({
        data: { types: validInput.data.types },
        chainId: validInput.chainId,
        deviceModelId: validInput.deviceModelId,
        challenge: validInput.challenge,
      });

      expect(
        mockGatedDescriptorDataSource.getGatedDescriptorForTypedData,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          contractAddress: "0x0000000000000000000000000000000000000000",
        }),
      );
    });

    it("should request certificate for correct device model", async () => {
      vi.spyOn(
        mockGatedDescriptorDataSource,
        "getGatedDescriptorForTypedData",
      ).mockResolvedValue(Right({ signedDescriptor }));

      await loader.load({
        ...validInput,
        deviceModelId: DeviceModelId.FLEX,
      });

      expect(mockCertificateLoader.loadCertificate).toHaveBeenCalledWith({
        keyId: KeyId.CalGatedSigning,
        keyUsage: KeyUsage.GatedSigning,
        targetDevice: DeviceModelId.FLEX,
      });
    });

    it("should reject when certificate loading fails", async () => {
      const certificateError = new Error("Certificate loading failed");
      vi.spyOn(
        mockGatedDescriptorDataSource,
        "getGatedDescriptorForTypedData",
      ).mockResolvedValue(Right({ signedDescriptor }));
      vi.spyOn(mockCertificateLoader, "loadCertificate").mockRejectedValue(
        certificateError,
      );

      await expect(loader.load(validInput)).rejects.toThrow(certificateError);
    });

    it("should return PROXY_INFO and GATED_SIGNING when verifying contract is proxy and gated descriptor exists for implementation", async () => {
      const implementationAddress =
        "0xabcdef1234567890abcdef1234567890abcdef12";
      const proxySignedDescriptor = "0xproxy-descriptor";
      vi.spyOn(mockGatedDescriptorDataSource, "getGatedDescriptorForTypedData")
        .mockResolvedValueOnce(Left(new Error("No gated descriptor")))
        .mockResolvedValueOnce(Right({ signedDescriptor }));
      vi.spyOn(
        mockProxyDataSource,
        "getProxyImplementationAddress",
      ).mockResolvedValue(
        Right({
          implementationAddress,
          signedDescriptor: proxySignedDescriptor,
          keyId: "domain-metadata",
          keyUsage: "trusted-name",
        }),
      );

      const result = await loader.load(validInput);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        type: ClearSignContextType.PROXY_INFO,
        payload: proxySignedDescriptor,
      });
      expect(result[1]).toMatchObject({
        type: ClearSignContextType.GATED_SIGNING,
        payload: signedDescriptor,
      });
      expect(
        mockGatedDescriptorDataSource.getGatedDescriptorForTypedData,
      ).toHaveBeenCalledTimes(2);
      expect(
        mockGatedDescriptorDataSource.getGatedDescriptorForTypedData,
      ).toHaveBeenNthCalledWith(1, {
        contractAddress:
          validInput.data.domain!.verifyingContract!.toLowerCase(),
        schemaHash: expect.any(String),
        chainId: validInput.chainId,
      });
      expect(
        mockGatedDescriptorDataSource.getGatedDescriptorForTypedData,
      ).toHaveBeenNthCalledWith(2, {
        contractAddress: implementationAddress.toLowerCase(),
        schemaHash: expect.any(String),
        chainId: validInput.chainId,
      });
    });
  });
});
