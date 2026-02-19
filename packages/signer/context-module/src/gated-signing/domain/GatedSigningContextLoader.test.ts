import { DeviceModelId } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";

import { type GatedDescriptorDataSource } from "@/gated-signing/data/GatedDescriptorDataSource";
import {
  type GatedSigningContextInput,
  GatedSigningContextLoader,
} from "@/gated-signing/domain/GatedSigningContextLoader";
import { type PkiCertificateLoader } from "@/pki/domain/PkiCertificateLoader";
import { KeyId } from "@/pki/model/KeyId";
import { KeyUsage } from "@/pki/model/KeyUsage";
import { type PkiCertificate } from "@/pki/model/PkiCertificate";
import { ClearSignContextType } from "@/shared/model/ClearSignContext";

describe("GatedSigningContextLoader", () => {
  const mockGatedDescriptorDataSource: GatedDescriptorDataSource = {
    getGatedDescriptor: vi.fn(),
  };

  const mockCertificateLoader: PkiCertificateLoader = {
    loadCertificate: vi.fn(),
  };

  const loader = new GatedSigningContextLoader(
    mockGatedDescriptorDataSource,
    mockCertificateLoader,
  );

  const mockCertificate: PkiCertificate = {
    keyUsageNumber: 1,
    payload: new Uint8Array([0x01, 0x02, 0x03]),
  };

  const SUPPORTED_TYPES: ClearSignContextType[] = [
    ClearSignContextType.GATED_SIGNING,
  ];

  beforeEach(() => {
    vi.resetAllMocks();
    vi.spyOn(mockCertificateLoader, "loadCertificate").mockResolvedValue(
      mockCertificate,
    );
  });

  describe("canHandle function", () => {
    const validInput: GatedSigningContextInput = {
      to: "0x1111111254fb6c44bac0bed2854e76f90643097d",
      selector: "0xa1251d75",
      chainId: 1,
      deviceModelId: DeviceModelId.STAX,
    };

    it("should return true for valid input", () => {
      expect(loader.canHandle(validInput, SUPPORTED_TYPES)).toBe(true);
    });

    it("should return false for invalid expected type", () => {
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
      [123, "number input"],
    ])("should return false for %s", (input, _description) => {
      expect(loader.canHandle(input, SUPPORTED_TYPES)).toBe(false);
    });

    it.each([
      [{ ...validInput, to: undefined }, "missing to"],
      [{ ...validInput, selector: undefined }, "missing selector"],
      [{ ...validInput, chainId: undefined }, "missing chainId"],
      [{ ...validInput, deviceModelId: undefined }, "missing deviceModelId"],
    ])("should return false for %s", (input, _description) => {
      expect(loader.canHandle(input, SUPPORTED_TYPES)).toBe(false);
    });

    it.each([
      [{ ...validInput, to: "0x" }, "empty to (0x)"],
      [{ ...validInput, to: "not-hex" }, "non-hex to"],
      [{ ...validInput, selector: "not-hex" }, "non-hex selector"],
      [{ ...validInput, chainId: "1" as unknown as number }, "string chainId"],
      [{ ...validInput, chainId: null as unknown as number }, "null chainId"],
    ])("should return false for %s", (input, _description) => {
      expect(loader.canHandle(input, SUPPORTED_TYPES)).toBe(false);
    });
  });

  describe("load function", () => {
    const validInput: GatedSigningContextInput = {
      to: "0x1111111254fb6c44bac0bed2854e76f90643097d",
      selector: "0xa1251d75",
      chainId: 1,
      deviceModelId: DeviceModelId.STAX,
    };

    const signedDescriptor =
      "010122020101222a30783131313131313235346662366334346261633062656432383534653736663930363433303937642308000000000000000140086131323531643735150100";

    it("should return error context when getGatedDescriptor returns Left", async () => {
      const error = new Error("Failed to fetch gated descriptors");
      vi.spyOn(
        mockGatedDescriptorDataSource,
        "getGatedDescriptor",
      ).mockResolvedValue(Left(error));

      const result = await loader.load(validInput);

      expect(result).toEqual([
        {
          type: ClearSignContextType.ERROR,
          error,
        },
      ]);
      expect(
        mockGatedDescriptorDataSource.getGatedDescriptor,
      ).toHaveBeenCalledWith({
        contractAddress: validInput.to,
        selector: validInput.selector,
        chainId: validInput.chainId,
      });
      expect(mockCertificateLoader.loadCertificate).not.toHaveBeenCalled();
    });

    it("should return gated signing context when getGatedDescriptor succeeds", async () => {
      vi.spyOn(
        mockGatedDescriptorDataSource,
        "getGatedDescriptor",
      ).mockResolvedValue(Right({ signedDescriptor }));

      const result = await loader.load(validInput);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        type: ClearSignContextType.GATED_SIGNING,
        payload: signedDescriptor,
        certificate: mockCertificate,
      });
      expect(
        mockGatedDescriptorDataSource.getGatedDescriptor,
      ).toHaveBeenCalledWith({
        contractAddress: validInput.to,
        selector: validInput.selector,
        chainId: validInput.chainId,
      });
      expect(mockCertificateLoader.loadCertificate).toHaveBeenCalledWith({
        keyId: KeyId.CalGatedSigning,
        keyUsage: KeyUsage.GatedSigning,
        targetDevice: validInput.deviceModelId,
      });
    });

    it("should pass to as contractAddress to getGatedDescriptor", async () => {
      const customTo = "0xabcdef1234567890abcdef1234567890abcdef12";
      vi.spyOn(
        mockGatedDescriptorDataSource,
        "getGatedDescriptor",
      ).mockResolvedValue(Right({ signedDescriptor }));

      await loader.load({
        ...validInput,
        to: customTo,
      });

      expect(
        mockGatedDescriptorDataSource.getGatedDescriptor,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          contractAddress: customTo,
        }),
      );
    });

    it("should request certificate for correct device model", async () => {
      vi.spyOn(
        mockGatedDescriptorDataSource,
        "getGatedDescriptor",
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
        "getGatedDescriptor",
      ).mockResolvedValue(Right({ signedDescriptor }));
      vi.spyOn(mockCertificateLoader, "loadCertificate").mockRejectedValue(
        certificateError,
      );

      await expect(loader.load(validInput)).rejects.toThrow(certificateError);
    });
  });
});
