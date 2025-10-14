import { DeviceModelId } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";

import { type PkiCertificateLoader } from "@/pki/domain/PkiCertificateLoader";
import { type PkiCertificate } from "@/pki/model/PkiCertificate";
import {
  type GetSafeAccountResponse,
  type SafeAccountDataSource,
} from "@/safe/data/SafeAccountDataSource";
import {
  type SafeAccountContextInput,
  SafeAccountLoader,
} from "@/safe/domain/SafeAccountLoader";
import {
  type ClearSignContextSuccess,
  ClearSignContextType,
} from "@/shared/model/ClearSignContext";

describe("SafeAccountLoader", () => {
  const mockSafeAccountDataSource: SafeAccountDataSource = {
    getDescriptors: vi.fn(),
  };
  const mockPkiCertificateLoader: PkiCertificateLoader = {
    loadCertificate: vi.fn(),
  };
  const loader = new SafeAccountLoader(
    mockSafeAccountDataSource,
    mockPkiCertificateLoader,
  );

  const mockCertificate: PkiCertificate = {
    keyUsageNumber: 1,
    payload: new Uint8Array([1, 2, 3]),
  };

  const mockSafeAccountResponse: GetSafeAccountResponse = {
    account: {
      signedDescriptor: "safe-descriptor-payload",
      keyId: "safe-key-id",
      keyUsage: "safe-key-usage",
    },
    signers: {
      signedDescriptor: "signers-descriptor-payload",
      keyId: "signers-key-id",
      keyUsage: "signers-key-usage",
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(mockPkiCertificateLoader, "loadCertificate").mockResolvedValue(
      mockCertificate,
    );
  });

  describe("canHandle function", () => {
    const validInput: SafeAccountContextInput = {
      safeContractAddress: "0x1234567890123456789012345678901234567890",
      chainId: 1,
      deviceModelId: DeviceModelId.FLEX,
      challenge: "0xabcdef",
    };

    it("should return true for valid input with SAFE and SIGNER types", () => {
      expect(
        loader.canHandle(validInput, [
          ClearSignContextType.SAFE,
          ClearSignContextType.SIGNER,
        ]),
      ).toBe(true);
    });

    it("should return true when expected types are subset of SAFE and SIGNER", () => {
      expect(loader.canHandle(validInput, [ClearSignContextType.SAFE])).toBe(
        true,
      );
      expect(loader.canHandle(validInput, [ClearSignContextType.SIGNER])).toBe(
        true,
      );
    });

    it("should return false when expected types include unsupported types", () => {
      expect(loader.canHandle(validInput, [ClearSignContextType.TOKEN])).toBe(
        false,
      );
      expect(loader.canHandle(validInput, [ClearSignContextType.NFT])).toBe(
        false,
      );
    });

    it("should return false when expected types include other types besides SAFE and SIGNER", () => {
      expect(
        loader.canHandle(validInput, [
          ClearSignContextType.SAFE,
          ClearSignContextType.SIGNER,
          ClearSignContextType.TOKEN,
        ]),
      ).toBe(false);
    });

    it.each([
      [null, "null input"],
      [undefined, "undefined input"],
      [{}, "empty object"],
      ["string", "string input"],
      [123, "number input"],
      [[], "array input"],
    ])("should return false for %s", (input, _description) => {
      expect(
        loader.canHandle(input, [
          ClearSignContextType.SAFE,
          ClearSignContextType.SIGNER,
        ]),
      ).toBe(false);
    });

    it.each([
      [
        { ...validInput, safeContractAddress: undefined },
        "missing safeContractAddress",
      ],
      [{ ...validInput, chainId: undefined }, "missing chainId"],
      [{ ...validInput, deviceModelId: undefined }, "missing deviceModelId"],
      [{ ...validInput, challenge: undefined }, "missing challenge"],
    ])("should return false for %s", (input, _description) => {
      expect(
        loader.canHandle(input, [
          ClearSignContextType.SAFE,
          ClearSignContextType.SIGNER,
        ]),
      ).toBe(false);
    });

    it.each([
      [
        { ...validInput, safeContractAddress: "invalid-hex" },
        "invalid safeContractAddress hex",
      ],
      [
        { ...validInput, safeContractAddress: "0x" },
        "empty safeContractAddress (0x)",
      ],
      [
        { ...validInput, safeContractAddress: "not-hex" },
        "non-hex safeContractAddress",
      ],
      [
        { ...validInput, safeContractAddress: 123 },
        "number safeContractAddress",
      ],
    ])("should return false for %s", (input, _description) => {
      expect(
        loader.canHandle(input, [
          ClearSignContextType.SAFE,
          ClearSignContextType.SIGNER,
        ]),
      ).toBe(false);
    });

    it.each([
      [{ ...validInput, chainId: "1" }, "string chainId"],
      [{ ...validInput, chainId: null }, "null chainId"],
      [{ ...validInput, chainId: undefined }, "undefined chainId"],
    ])("should return false for %s", (input, _description) => {
      expect(
        loader.canHandle(input, [
          ClearSignContextType.SAFE,
          ClearSignContextType.SIGNER,
        ]),
      ).toBe(false);
    });

    it.each([
      [{ ...validInput, challenge: "" }, "empty challenge string"],
      [{ ...validInput, challenge: 123 }, "number challenge"],
      [{ ...validInput, challenge: null }, "null challenge"],
    ])("should return false for %s", (input, _description) => {
      expect(
        loader.canHandle(input, [
          ClearSignContextType.SAFE,
          ClearSignContextType.SIGNER,
        ]),
      ).toBe(false);
    });

    it("should return true for different device models", () => {
      expect(
        loader.canHandle(
          { ...validInput, deviceModelId: DeviceModelId.NANO_S },
          [ClearSignContextType.SAFE, ClearSignContextType.SIGNER],
        ),
      ).toBe(true);
      expect(
        loader.canHandle(
          { ...validInput, deviceModelId: DeviceModelId.NANO_SP },
          [ClearSignContextType.SAFE, ClearSignContextType.SIGNER],
        ),
      ).toBe(true);
      expect(
        loader.canHandle(
          { ...validInput, deviceModelId: DeviceModelId.NANO_X },
          [ClearSignContextType.SAFE, ClearSignContextType.SIGNER],
        ),
      ).toBe(true);
      expect(
        loader.canHandle({ ...validInput, deviceModelId: DeviceModelId.STAX }, [
          ClearSignContextType.SAFE,
          ClearSignContextType.SIGNER,
        ]),
      ).toBe(true);
      expect(
        loader.canHandle({ ...validInput, deviceModelId: DeviceModelId.FLEX }, [
          ClearSignContextType.SAFE,
          ClearSignContextType.SIGNER,
        ]),
      ).toBe(true);
    });

    it("should return true for different chain IDs", () => {
      expect(
        loader.canHandle({ ...validInput, chainId: 1 }, [
          ClearSignContextType.SAFE,
          ClearSignContextType.SIGNER,
        ]),
      ).toBe(true);
      expect(
        loader.canHandle({ ...validInput, chainId: 137 }, [
          ClearSignContextType.SAFE,
          ClearSignContextType.SIGNER,
        ]),
      ).toBe(true);
      expect(
        loader.canHandle({ ...validInput, chainId: 10 }, [
          ClearSignContextType.SAFE,
          ClearSignContextType.SIGNER,
        ]),
      ).toBe(true);
    });
  });

  describe("load function", () => {
    const input: SafeAccountContextInput = {
      safeContractAddress: "0x1234567890123456789012345678901234567890",
      chainId: 1,
      deviceModelId: DeviceModelId.FLEX,
      challenge: "0xabcdef",
    };

    it("should return SAFE and SIGNER contexts with certificates", async () => {
      // GIVEN
      vi.spyOn(mockSafeAccountDataSource, "getDescriptors").mockResolvedValue(
        Right(mockSafeAccountResponse),
      );

      // WHEN
      const result = await loader.load(input);

      // THEN
      expect(mockSafeAccountDataSource.getDescriptors).toHaveBeenCalledWith({
        safeContractAddress: "0x1234567890123456789012345678901234567890",
        chainId: 1,
        challenge: "0xabcdef",
      });
      expect(mockPkiCertificateLoader.loadCertificate).toHaveBeenCalledTimes(2);
      expect(mockPkiCertificateLoader.loadCertificate).toHaveBeenNthCalledWith(
        1,
        {
          keyId: "safe-key-id",
          keyUsage: "safe-key-usage",
          targetDevice: DeviceModelId.FLEX,
        },
      );
      expect(mockPkiCertificateLoader.loadCertificate).toHaveBeenNthCalledWith(
        2,
        {
          keyId: "signers-key-id",
          keyUsage: "signers-key-usage",
          targetDevice: DeviceModelId.FLEX,
        },
      );
      expect(result).toEqual([
        {
          type: ClearSignContextType.SAFE,
          payload: "safe-descriptor-payload",
          certificate: mockCertificate,
        },
        {
          type: ClearSignContextType.SIGNER,
          payload: "signers-descriptor-payload",
          certificate: mockCertificate,
        },
      ]);
    });

    it("should return SAFE and SIGNER contexts without certificates when loadCertificate returns undefined", async () => {
      // GIVEN
      vi.spyOn(mockSafeAccountDataSource, "getDescriptors").mockResolvedValue(
        Right(mockSafeAccountResponse),
      );
      vi.spyOn(mockPkiCertificateLoader, "loadCertificate").mockResolvedValue(
        undefined,
      );

      // WHEN
      const result = await loader.load(input);

      // THEN
      expect(result).toEqual([
        {
          type: ClearSignContextType.SAFE,
          payload: "safe-descriptor-payload",
          certificate: undefined,
        },
        {
          type: ClearSignContextType.SIGNER,
          payload: "signers-descriptor-payload",
          certificate: undefined,
        },
      ]);
    });

    it("should return ERROR context when data source returns Left", async () => {
      // GIVEN
      const error = new Error("Failed to get safe account descriptors");
      vi.spyOn(mockSafeAccountDataSource, "getDescriptors").mockResolvedValue(
        Left(error),
      );

      // WHEN
      const result = await loader.load(input);

      // THEN
      expect(result).toEqual([
        {
          type: ClearSignContextType.ERROR,
          error,
        },
      ]);
      expect(mockPkiCertificateLoader.loadCertificate).not.toHaveBeenCalled();
    });

    it("should work with different device models", async () => {
      // GIVEN
      const inputNanoS = { ...input, deviceModelId: DeviceModelId.NANO_S };
      vi.spyOn(mockSafeAccountDataSource, "getDescriptors").mockResolvedValue(
        Right(mockSafeAccountResponse),
      );

      // WHEN
      const result = await loader.load(inputNanoS);

      // THEN
      expect(mockPkiCertificateLoader.loadCertificate).toHaveBeenCalledWith(
        expect.objectContaining({
          targetDevice: DeviceModelId.NANO_S,
        }),
      );
      expect(result).toHaveLength(2);
      expect(result[0]?.type).toBe(ClearSignContextType.SAFE);
      expect(result[1]?.type).toBe(ClearSignContextType.SIGNER);
    });

    it("should work with different chain IDs", async () => {
      // GIVEN
      const inputPolygon = { ...input, chainId: 137 };
      vi.spyOn(mockSafeAccountDataSource, "getDescriptors").mockResolvedValue(
        Right(mockSafeAccountResponse),
      );

      // WHEN
      await loader.load(inputPolygon);

      // THEN
      expect(mockSafeAccountDataSource.getDescriptors).toHaveBeenCalledWith(
        expect.objectContaining({
          chainId: 137,
        }),
      );
    });

    it("should work with different safe addresses", async () => {
      // GIVEN
      const differentInput = {
        ...input,
        safeContractAddress:
          "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as const,
      };
      vi.spyOn(mockSafeAccountDataSource, "getDescriptors").mockResolvedValue(
        Right(mockSafeAccountResponse),
      );

      // WHEN
      await loader.load(differentInput);

      // THEN
      expect(mockSafeAccountDataSource.getDescriptors).toHaveBeenCalledWith(
        expect.objectContaining({
          safeContractAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
        }),
      );
    });

    it("should handle different certificate data for account and signers", async () => {
      // GIVEN
      const accountCertificate: PkiCertificate = {
        keyUsageNumber: 1,
        payload: new Uint8Array([1, 2, 3]),
      };
      const signersCertificate: PkiCertificate = {
        keyUsageNumber: 2,
        payload: new Uint8Array([4, 5, 6]),
      };
      vi.spyOn(mockSafeAccountDataSource, "getDescriptors").mockResolvedValue(
        Right(mockSafeAccountResponse),
      );
      vi.spyOn(mockPkiCertificateLoader, "loadCertificate")
        .mockResolvedValueOnce(accountCertificate)
        .mockResolvedValueOnce(signersCertificate);

      // WHEN
      const result = await loader.load(input);

      // THEN
      expect(result).toEqual([
        {
          type: ClearSignContextType.SAFE,
          payload: "safe-descriptor-payload",
          certificate: accountCertificate,
        },
        {
          type: ClearSignContextType.SIGNER,
          payload: "signers-descriptor-payload",
          certificate: signersCertificate,
        },
      ]);
    });

    it("should handle empty descriptor payloads", async () => {
      // GIVEN
      const emptyResponse: GetSafeAccountResponse = {
        account: {
          signedDescriptor: "",
          keyId: "key-id",
          keyUsage: "key-usage",
        },
        signers: {
          signedDescriptor: "",
          keyId: "key-id",
          keyUsage: "key-usage",
        },
      };
      vi.spyOn(mockSafeAccountDataSource, "getDescriptors").mockResolvedValue(
        Right(emptyResponse),
      );

      // WHEN
      const result = await loader.load(input);

      // THEN
      expect(result).toEqual([
        {
          type: ClearSignContextType.SAFE,
          payload: "",
          certificate: mockCertificate,
        },
        {
          type: ClearSignContextType.SIGNER,
          payload: "",
          certificate: mockCertificate,
        },
      ]);
    });

    it("should handle long descriptor payloads", async () => {
      // GIVEN
      const longPayload = "a".repeat(1000);
      const longResponse: GetSafeAccountResponse = {
        account: {
          signedDescriptor: longPayload,
          keyId: "key-id",
          keyUsage: "key-usage",
        },
        signers: {
          signedDescriptor: longPayload,
          keyId: "key-id",
          keyUsage: "key-usage",
        },
      };
      vi.spyOn(mockSafeAccountDataSource, "getDescriptors").mockResolvedValue(
        Right(longResponse),
      );

      // WHEN
      const result = await loader.load(input);

      // THEN
      expect((result[0] as ClearSignContextSuccess).payload).toBe(longPayload);
      expect((result[1] as ClearSignContextSuccess).payload).toBe(longPayload);
    });

    it("should handle data source errors gracefully", async () => {
      // GIVEN
      const error = new Error("Network error");
      vi.spyOn(mockSafeAccountDataSource, "getDescriptors").mockResolvedValue(
        Left(error),
      );

      // WHEN
      const result = await loader.load(input);

      // THEN
      expect(result).toEqual([
        {
          type: ClearSignContextType.ERROR,
          error: new Error("Network error"),
        },
      ]);
    });
  });
});
