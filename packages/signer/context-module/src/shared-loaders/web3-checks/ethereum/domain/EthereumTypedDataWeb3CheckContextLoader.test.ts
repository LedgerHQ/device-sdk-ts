import { DeviceModelId } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";

import type { PkiCertificateLoader } from "@/chain-agnostic-loaders/pki/domain/PkiCertificateLoader";
import { KeyUsage } from "@/chain-agnostic-loaders/pki/model/KeyUsage";
import { ClearSignContextType } from "@/shared/model/ClearSignContext";
import { type Web3CheckDataSource } from "@/shared-loaders/web3-checks/data/Web3CheckDataSource";
import {
  type EthereumTypedDataWeb3CheckContextInput,
  EthereumTypedDataWeb3CheckContextLoader,
  type TypedData,
} from "@/shared-loaders/web3-checks/ethereum/domain/EthereumTypedDataWeb3CheckContextLoader";
import { Web3CheckPaths } from "@/shared-loaders/web3-checks/utils/constants";

const mockLoggerFactory = () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
});

describe("EthereumTypedDataWeb3CheckContextLoader", () => {
  const mockWeb3CheckDataSource: Web3CheckDataSource = {
    check: vi.fn(),
  };
  const mockCertificateLoader: PkiCertificateLoader = {
    loadCertificate: vi.fn(),
  };
  const loader = new EthereumTypedDataWeb3CheckContextLoader(
    mockWeb3CheckDataSource,
    mockCertificateLoader,
    mockLoggerFactory,
  );

  const SUPPORTED_TYPES: ClearSignContextType[] = [
    ClearSignContextType.ETHEREUM_WEB3_CHECK,
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

    const validInput: EthereumTypedDataWeb3CheckContextInput = {
      from: "0x1234567890123456789012345678901234567890",
      data: validTypedData,
      deviceModelId: DeviceModelId.FLEX,
    };

    it("should return true for valid input", () => {
      expect(loader.canHandle(validInput, SUPPORTED_TYPES)).toBe(true);
    });

    it("should return false for invalid expected type", () => {
      expect(
        loader.canHandle(validInput, [ClearSignContextType.ETHEREUM_TOKEN]),
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

    const validInput: EthereumTypedDataWeb3CheckContextInput = {
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
      vi.spyOn(mockWeb3CheckDataSource, "check").mockResolvedValue(Left(error));

      const result = await loader.load(validInput);

      expect(result).toEqual([
        {
          type: ClearSignContextType.ERROR,
          error,
        },
      ]);
    });

    it("should return transaction check context when successful", async () => {
      const checkData = {
        publicKeyId: "test-key-id",
        descriptor: "test-descriptor",
      };
      vi.spyOn(mockWeb3CheckDataSource, "check").mockResolvedValue(
        Right(checkData),
      );
      vi.spyOn(mockCertificateLoader, "loadCertificate").mockResolvedValue(
        mockCertificate,
      );

      const result = await loader.load(validInput);

      expect(mockWeb3CheckDataSource.check).toHaveBeenCalledWith({
        path: Web3CheckPaths.ETHEREUM_TYPED_DATA,
        body: { msg: { from: validInput.from, data: validInput.data } },
      });

      expect(mockCertificateLoader.loadCertificate).toHaveBeenCalledWith({
        keyId: checkData.publicKeyId,
        keyUsage: KeyUsage.TxSimulationSigner,
        targetDevice: validInput.deviceModelId,
      });

      expect(result).toEqual([
        {
          type: ClearSignContextType.ETHEREUM_WEB3_CHECK,
          payload: checkData.descriptor,
          certificate: mockCertificate,
        },
      ]);
    });

    it("should handle certificate loading failure", async () => {
      vi.spyOn(mockWeb3CheckDataSource, "check").mockResolvedValue(
        Right({ publicKeyId: "test-key-id", descriptor: "test-descriptor" }),
      );
      vi.spyOn(mockCertificateLoader, "loadCertificate").mockRejectedValue(
        new Error("Certificate loading failed"),
      );

      await expect(loader.load(validInput)).rejects.toThrow(
        "Certificate loading failed",
      );
    });

    it("should call check with correct path and body", async () => {
      vi.spyOn(mockWeb3CheckDataSource, "check").mockResolvedValue(
        Right({ publicKeyId: "test-key-id", descriptor: "test-descriptor" }),
      );
      vi.spyOn(mockCertificateLoader, "loadCertificate").mockResolvedValue(
        mockCertificate,
      );

      await loader.load(validInput);

      expect(mockWeb3CheckDataSource.check).toHaveBeenCalledWith({
        path: Web3CheckPaths.ETHEREUM_TYPED_DATA,
        body: { msg: { from: validInput.from, data: validTypedData } },
      });
    });
  });
});
