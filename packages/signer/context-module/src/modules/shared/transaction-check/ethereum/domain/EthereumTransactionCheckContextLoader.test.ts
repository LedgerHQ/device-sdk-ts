import { DeviceModelId } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";

import type { PkiCertificateLoader } from "@/modules/chain-agnostic/pki/domain/PkiCertificateLoader";
import { KeyUsage } from "@/modules/chain-agnostic/pki/model/KeyUsage";
import { type TransactionCheckDataSource } from "@/modules/shared/transaction-check/data/TransactionCheckDataSource";
import {
  type EthereumTransactionCheckContextInput,
  EthereumTransactionCheckContextLoader,
} from "@/modules/shared/transaction-check/ethereum/domain/EthereumTransactionCheckContextLoader";
import { TransactionCheckPaths } from "@/modules/shared/transaction-check/utils/constants";
import { ClearSignContextType } from "@/shared/model/ClearSignContext";

const mockLoggerFactory = () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
});

describe("EthereumTransactionCheckContextLoader", () => {
  const mockTransactionCheckDataSource: TransactionCheckDataSource = {
    check: vi.fn(),
  };
  const mockCertificateLoader: PkiCertificateLoader = {
    loadCertificate: vi.fn(),
  };
  const loader = new EthereumTransactionCheckContextLoader(
    mockTransactionCheckDataSource,
    mockCertificateLoader,
    mockLoggerFactory,
  );

  const SUPPORTED_TYPES: ClearSignContextType[] = [
    ClearSignContextType.ETHEREUM_TRANSACTION_CHECK,
  ];

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("canHandle function", () => {
    const validInput: EthereumTransactionCheckContextInput = {
      from: "0x1234567890123456789012345678901234567890",
      chainId: 1,
      transaction: new Uint8Array([1, 2, 3]),
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
      [{ ...validInput, chainId: undefined }, "missing chainId"],
      [{ ...validInput, transaction: undefined }, "missing transaction"],
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

    it("should return false for non-number chainId", () => {
      const inputWithInvalidChainId = {
        ...validInput,
        chainId: "not-a-number" as unknown as number,
      };
      expect(loader.canHandle(inputWithInvalidChainId, SUPPORTED_TYPES)).toBe(
        false,
      );
    });
  });

  describe("load function", () => {
    const validInput: EthereumTransactionCheckContextInput = {
      from: "0x1234567890123456789012345678901234567890",
      chainId: 1,
      transaction: new Uint8Array([1, 2, 3]),
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

    it("should return error context when transaction check fails", async () => {
      const error = new Error("Transaction check failed");
      vi.spyOn(mockTransactionCheckDataSource, "check").mockResolvedValue(
        Left(error),
      );

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
      vi.spyOn(mockTransactionCheckDataSource, "check").mockResolvedValue(
        Right(checkData),
      );
      vi.spyOn(mockCertificateLoader, "loadCertificate").mockResolvedValue(
        mockCertificate,
      );

      const result = await loader.load(validInput);

      expect(mockTransactionCheckDataSource.check).toHaveBeenCalledWith({
        path: TransactionCheckPaths.ETHEREUM_TRANSACTION,
        body: {
          tx: { from: validInput.from, raw: "0x010203" },
          chain: validInput.chainId,
        },
      });

      expect(mockCertificateLoader.loadCertificate).toHaveBeenCalledWith({
        keyId: checkData.publicKeyId,
        keyUsage: KeyUsage.TxSimulationSigner,
        targetDevice: validInput.deviceModelId,
      });

      expect(result).toEqual([
        {
          type: ClearSignContextType.ETHEREUM_TRANSACTION_CHECK,
          payload: checkData.descriptor,
          certificate: mockCertificate,
        },
      ]);
    });

    it("should handle certificate loading failure", async () => {
      vi.spyOn(mockTransactionCheckDataSource, "check").mockResolvedValue(
        Right({ publicKeyId: "test-key-id", descriptor: "test-descriptor" }),
      );
      vi.spyOn(mockCertificateLoader, "loadCertificate").mockRejectedValue(
        new Error("Certificate loading failed"),
      );

      await expect(loader.load(validInput)).rejects.toThrow(
        "Certificate loading failed",
      );
    });

    it("should convert transaction buffer to hex string correctly", async () => {
      vi.spyOn(mockTransactionCheckDataSource, "check").mockResolvedValue(
        Right({ publicKeyId: "test-key-id", descriptor: "test-descriptor" }),
      );
      vi.spyOn(mockCertificateLoader, "loadCertificate").mockResolvedValue(
        mockCertificate,
      );

      await loader.load(validInput);

      expect(mockTransactionCheckDataSource.check).toHaveBeenCalledWith({
        path: TransactionCheckPaths.ETHEREUM_TRANSACTION,
        body: {
          tx: { from: validInput.from, raw: "0x010203" },
          chain: validInput.chainId,
        },
      });
    });
  });
});
