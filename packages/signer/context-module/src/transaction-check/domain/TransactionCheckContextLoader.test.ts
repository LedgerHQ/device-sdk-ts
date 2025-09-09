import { Left, Right } from "purify-ts";

import { type PkiCertificateLoader } from "@/pki/domain/PkiCertificateLoader";
import { KeyUsage } from "@/pki/model/KeyUsage";
import { ClearSignContextType } from "@/shared/model/ClearSignContext";
import { type TransactionContext } from "@/shared/model/TransactionContext";
import { type TransactionCheckDataSource } from "@/transaction-check/data/TransactionCheckDataSource";
import { TransactionCheckContextLoader } from "@/transaction-check/domain/TransactionCheckContextLoader";

describe("TransactionCheckContextLoader", () => {
  const mockTransactionCheckDataSource: TransactionCheckDataSource = {
    getTransactionCheck: vi.fn(),
  };

  const mockPkiCertificateLoader: PkiCertificateLoader = {
    loadCertificate: vi.fn(),
  };

  const loader = new TransactionCheckContextLoader(
    mockTransactionCheckDataSource,
    mockPkiCertificateLoader,
  );

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("load", () => {
    const transactionContext = {
      from: "0x1234567890123456789012345678901234567890",
      chainId: 1,
      rawTx: "0x010203",
      deviceModelId: "nanoS" as const,
      selector: "0x12345678",
      data: "0xdata",
    } as TransactionContext;

    it("should call the dataSource with the correct params", async () => {
      // GIVEN
      vi.spyOn(
        mockTransactionCheckDataSource,
        "getTransactionCheck",
      ).mockResolvedValue(
        Right({
          publicKeyId: "test-key-id",
          descriptor: "test-descriptor",
        }),
      );
      vi.spyOn(mockPkiCertificateLoader, "loadCertificate").mockResolvedValue({
        keyUsageNumber: 1,
        payload: new Uint8Array([1, 2, 3]),
      });

      // WHEN
      await loader.load(transactionContext);

      // THEN
      expect(
        mockTransactionCheckDataSource.getTransactionCheck,
      ).toHaveBeenCalledWith({
        from: "0x1234567890123456789012345678901234567890",
        chainId: 1,
        rawTx: "0x010203",
      });
    });

    it("should return an error context when dataSource returns an error", async () => {
      // GIVEN
      const error = new Error("Transaction check failed");
      vi.spyOn(
        mockTransactionCheckDataSource,
        "getTransactionCheck",
      ).mockResolvedValue(Left(error));

      // WHEN
      const result = await loader.load(transactionContext);

      // THEN
      expect(result).toEqual([
        {
          type: ClearSignContextType.ERROR,
          error,
        },
      ]);
    });

    it("should return a transaction check context when dataSource returns data", async () => {
      // GIVEN
      const transactionCheck = {
        publicKeyId: "test-key-id",
        descriptor: "test-descriptor",
      };
      const certificate = {
        keyUsageNumber: 1,
        payload: new Uint8Array([1, 2, 3]),
      };

      vi.spyOn(
        mockTransactionCheckDataSource,
        "getTransactionCheck",
      ).mockResolvedValue(Right(transactionCheck));
      vi.spyOn(mockPkiCertificateLoader, "loadCertificate").mockResolvedValue(
        certificate,
      );

      // WHEN
      const result = await loader.load(transactionContext);

      // THEN
      expect(result).toEqual([
        {
          type: ClearSignContextType.TRANSACTION_CHECK,
          payload: "test-descriptor",
          certificate,
        },
      ]);
    });

    it("should call the certificate loader with correct parameters", async () => {
      // GIVEN
      vi.spyOn(
        mockTransactionCheckDataSource,
        "getTransactionCheck",
      ).mockResolvedValue(
        Right({
          publicKeyId: "test-key-id",
          descriptor: "test-descriptor",
        }),
      );
      vi.spyOn(mockPkiCertificateLoader, "loadCertificate").mockResolvedValue({
        keyUsageNumber: 1,
        payload: new Uint8Array([1, 2, 3]),
      });

      // WHEN
      await loader.load(transactionContext);

      // THEN
      expect(mockPkiCertificateLoader.loadCertificate).toHaveBeenCalledWith({
        keyId: "test-key-id",
        keyUsage: KeyUsage.TxSimulationSigner,
        targetDevice: "nanoS",
      });
    });

    it("should return an empty array when from is not provided", async () => {
      // GIVEN
      const transactionContextWithoutFrom = {
        ...transactionContext,
        from: undefined,
      } as TransactionContext;

      // WHEN
      const result = await loader.load(transactionContextWithoutFrom);

      // THEN
      expect(result).toEqual([]);
      expect(
        mockTransactionCheckDataSource.getTransactionCheck,
      ).not.toHaveBeenCalled();
    });

    it("should return an empty array when from is empty string", async () => {
      // GIVEN
      const transactionContextWithEmptyFrom = {
        ...transactionContext,
        from: "",
      } as TransactionContext;

      // WHEN
      const result = await loader.load(transactionContextWithEmptyFrom);

      // THEN
      expect(result).toEqual([]);
      expect(
        mockTransactionCheckDataSource.getTransactionCheck,
      ).not.toHaveBeenCalled();
    });

    it("should return an empty array when rawTx is not provided", async () => {
      // GIVEN
      const transactionContextWithoutRawTx = {
        ...transactionContext,
        rawTx: undefined,
      } as TransactionContext;

      // WHEN
      const result = await loader.load(transactionContextWithoutRawTx);

      // THEN
      expect(result).toEqual([]);
      expect(
        mockTransactionCheckDataSource.getTransactionCheck,
      ).not.toHaveBeenCalled();
    });

    it("should return an empty array when rawTx is empty", async () => {
      // GIVEN
      const transactionContextWithEmptyRawTx = {
        ...transactionContext,
        rawTx: "",
      } as TransactionContext;

      // WHEN
      const result = await loader.load(transactionContextWithEmptyRawTx);

      // THEN
      expect(result).toEqual([]);
      expect(
        mockTransactionCheckDataSource.getTransactionCheck,
      ).not.toHaveBeenCalled();
    });

    it("should return an empty array when both from and rawTx are not provided", async () => {
      // GIVEN
      const transactionContextWithoutFromAndRawTx = {
        ...transactionContext,
        from: undefined,
        rawTx: undefined,
      } as TransactionContext;

      // WHEN
      const result = await loader.load(transactionContextWithoutFromAndRawTx);

      // THEN
      expect(result).toEqual([]);
      expect(
        mockTransactionCheckDataSource.getTransactionCheck,
      ).not.toHaveBeenCalled();
    });
  });
});
