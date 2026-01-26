import { DeviceModelId } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";

import type { PkiCertificateLoader } from "@/pki/domain/PkiCertificateLoader";
import { KeyUsage } from "@/pki/model/KeyUsage";
import { ClearSignContextType } from "@/shared/model/ClearSignContext";
import {
  type TypedData,
  type TypedDataCheckDataSource,
} from "@/transaction-check/data/TypedDataCheckDataSource";
import {
  type TypedDataCheckContextInput,
  TypedDataCheckContextLoader,
} from "@/transaction-check/domain/TypedDataCheckContextLoader";

const mockLoggerFactory = () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
});

describe("TypedDataCheckContextLoader", () => {
  const mockTypedDataCheckDataSource: TypedDataCheckDataSource = {
    getTypedDataCheck: vi.fn(),
  };
  const mockCertificateLoader: PkiCertificateLoader = {
    loadCertificate: vi.fn(),
  };
  const loader = new TypedDataCheckContextLoader(
    mockTypedDataCheckDataSource,
    mockCertificateLoader,
    mockLoggerFactory,
  );

  const SUPPORTED_TYPES: ClearSignContextType[] = [
    ClearSignContextType.TRANSACTION_CHECK,
  ];

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("canHandle function", () => {
    const validTypedData: TypedData = {
      domain: {
        name: "Test Domain",
        version: "1",
        chainId: 1,
        verifyingContract: "0x1234567890123456789012345678901234567890",
      },
      types: {
        EIP712Domain: [
          { name: "name", type: "string" },
          { name: "version", type: "string" },
          { name: "chainId", type: "uint256" },
          { name: "verifyingContract", type: "address" },
        ],
        Person: [
          { name: "name", type: "string" },
          { name: "wallet", type: "address" },
        ],
      },
      primaryType: "Person",
      message: {
        name: "Alice",
        wallet: "0x1234567890123456789012345678901234567890",
      },
    };

    const validInput: TypedDataCheckContextInput = {
      from: "0x1234567890123456789012345678901234567890",
      data: validTypedData,
      deviceModelId: DeviceModelId.FLEX,
    };

    it("should return true for valid input", () => {
      expect(loader.canHandle(validInput, SUPPORTED_TYPES)).toBe(true);
    });

    it("should return false for invalid expected type", () => {
      expect(loader.canHandle(validInput, [ClearSignContextType.TOKEN])).toBe(
        false,
      );
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
      [{ ...validInput, from: undefined }, "missing from"],
      [{ ...validInput, data: undefined }, "missing data"],
      [{ ...validInput, deviceModelId: undefined }, "missing deviceModelId"],
    ])("should return false for %s", (input, _description) => {
      expect(loader.canHandle(input, SUPPORTED_TYPES)).toBe(false);
    });

    it.each([
      [{ ...validInput, from: "invalid-hex" }, "invalid from hex"],
      [{ ...validInput, from: "0x" }, "empty from hex"],
      [{ ...validInput, from: "not-hex" }, "non-hex from"],
    ])("should return false for %s", (input, _description) => {
      expect(loader.canHandle(input, SUPPORTED_TYPES)).toBe(false);
    });

    it("should return false for NANO_S device model", () => {
      const inputWithNanoS = {
        ...validInput,
        deviceModelId: DeviceModelId.NANO_S,
      };
      expect(loader.canHandle(inputWithNanoS, SUPPORTED_TYPES)).toBe(false);
    });

    it("should return false for non-object data", () => {
      const inputWithInvalidData = {
        ...validInput,
        data: "not-an-object" as unknown as TypedData,
      };
      expect(loader.canHandle(inputWithInvalidData, SUPPORTED_TYPES)).toBe(
        false,
      );
    });
  });

  describe("load function", () => {
    const validTypedData: TypedData = {
      domain: {
        name: "Test Domain",
        version: "1",
        chainId: 1,
        verifyingContract: "0x1234567890123456789012345678901234567890",
      },
      types: {
        EIP712Domain: [
          { name: "name", type: "string" },
          { name: "version", type: "string" },
          { name: "chainId", type: "uint256" },
          { name: "verifyingContract", type: "address" },
        ],
        Person: [
          { name: "name", type: "string" },
          { name: "wallet", type: "address" },
        ],
      },
      primaryType: "Person",
      message: {
        name: "Alice",
        wallet: "0x1234567890123456789012345678901234567890",
      },
    };

    const validInput: TypedDataCheckContextInput = {
      from: "0x1234567890123456789012345678901234567890",
      data: validTypedData,
      deviceModelId: DeviceModelId.FLEX,
    };

    const mockCertificate = {
      descriptor: "cert-descriptor",
      signature: "cert-signature",
      keyUsageNumber: 0,
      payload: new Uint8Array(),
    };

    it("should return empty array when from is empty", async () => {
      const inputWithEmptyFrom = { ...validInput, from: "" };
      const result = await loader.load(inputWithEmptyFrom);
      expect(result).toEqual([]);
    });

    it("should return error context when typed data check fails", async () => {
      const error = new Error("Typed data check failed");
      vi.spyOn(
        mockTypedDataCheckDataSource,
        "getTypedDataCheck",
      ).mockResolvedValue(Left(error));

      const result = await loader.load(validInput);

      expect(result).toEqual([
        {
          type: ClearSignContextType.ERROR,
          error,
        },
      ]);
    });

    it("should return transaction check context when successful", async () => {
      const typedDataCheckData = {
        publicKeyId: "test-key-id",
        descriptor: "test-descriptor",
      };
      vi.spyOn(
        mockTypedDataCheckDataSource,
        "getTypedDataCheck",
      ).mockResolvedValue(Right(typedDataCheckData));
      vi.spyOn(mockCertificateLoader, "loadCertificate").mockResolvedValue(
        mockCertificate,
      );

      const result = await loader.load(validInput);

      expect(
        mockTypedDataCheckDataSource.getTypedDataCheck,
      ).toHaveBeenCalledWith({
        data: validInput.data,
        from: validInput.from,
      });

      expect(mockCertificateLoader.loadCertificate).toHaveBeenCalledWith({
        keyId: typedDataCheckData.publicKeyId,
        keyUsage: KeyUsage.TxSimulationSigner,
        targetDevice: validInput.deviceModelId,
      });

      expect(result).toEqual([
        {
          type: ClearSignContextType.TRANSACTION_CHECK,
          payload: typedDataCheckData.descriptor,
          certificate: mockCertificate,
        },
      ]);
    });

    it("should handle certificate loading failure", async () => {
      const typedDataCheckData = {
        publicKeyId: "test-key-id",
        descriptor: "test-descriptor",
      };
      const certificateError = new Error("Certificate loading failed");

      vi.spyOn(
        mockTypedDataCheckDataSource,
        "getTypedDataCheck",
      ).mockResolvedValue(Right(typedDataCheckData));
      vi.spyOn(mockCertificateLoader, "loadCertificate").mockRejectedValue(
        certificateError,
      );

      await expect(loader.load(validInput)).rejects.toThrow(certificateError);
    });

    it("should call typed data check with correct parameters", async () => {
      const typedDataCheckData = {
        publicKeyId: "test-key-id",
        descriptor: "test-descriptor",
      };
      vi.spyOn(
        mockTypedDataCheckDataSource,
        "getTypedDataCheck",
      ).mockResolvedValue(Right(typedDataCheckData));
      vi.spyOn(mockCertificateLoader, "loadCertificate").mockResolvedValue(
        mockCertificate,
      );

      await loader.load(validInput);

      expect(
        mockTypedDataCheckDataSource.getTypedDataCheck,
      ).toHaveBeenCalledWith({
        data: validTypedData,
        from: validInput.from,
      });
    });
  });
});
