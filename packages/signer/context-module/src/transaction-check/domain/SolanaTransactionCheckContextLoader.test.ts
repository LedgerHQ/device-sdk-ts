import { DeviceModelId } from "@ledgerhq/device-management-kit";
import bs58 from "bs58";
import { Left, Right } from "purify-ts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PkiCertificateLoader } from "@/pki/domain/PkiCertificateLoader";
import { KeyUsage } from "@/pki/model/KeyUsage";
import { SolanaContextTypes } from "@/shared/model/SolanaContextTypes";
import type { SolanaTransactionContext } from "@/solana/domain/solanaContextTypes";
import type { TransactionCheckDataSource } from "@/transaction-check/data/TransactionCheckDataSource";
import { SolanaTransactionCheckContextLoader } from "@/transaction-check/domain/SolanaTransactionCheckContextLoader";

const mockLoggerFactory = () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
});

describe("SolanaTransactionCheckContextLoader", () => {
  const fromB58 = bs58.encode(new Uint8Array(32).fill(7));
  const rawB58 = bs58.encode(new Uint8Array([1, 2, 3]));

  let mockTxCheck: TransactionCheckDataSource;
  let mockCert: PkiCertificateLoader;

  const baseContext = (): SolanaTransactionContext => ({
    deviceModelId: DeviceModelId.FLEX,
    transactionCheck: {
      from: fromB58,
      rawTx: rawB58,
      chain: 1,
    },
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    mockTxCheck = {
      getTransactionCheck: vi.fn(),
    };
    mockCert = {
      loadCertificate: vi.fn(),
    };
  });

  const makeLoader = () =>
    new SolanaTransactionCheckContextLoader(
      mockTxCheck,
      mockCert,
      mockLoggerFactory,
    );

  describe("canHandle", () => {
    it("returns true when transactionCheck has from and rawTx and device is not Nano S", () => {
      const loader = makeLoader();
      expect(
        loader.canHandle(baseContext(), SolanaContextTypes.TRANSACTION_CHECK),
      ).toBe(true);
    });

    it("returns false when expected type is not TRANSACTION_CHECK", () => {
      const loader = makeLoader();
      expect(
        loader.canHandle(baseContext(), SolanaContextTypes.SOLANA_TOKEN),
      ).toBe(false);
    });

    it("returns false for Nano S", () => {
      const loader = makeLoader();
      expect(
        loader.canHandle(
          {
            ...baseContext(),
            deviceModelId: DeviceModelId.NANO_S,
          },
          SolanaContextTypes.TRANSACTION_CHECK,
        ),
      ).toBe(false);
    });

    it("returns false when transactionCheck is missing", () => {
      const loader = makeLoader();
      expect(
        loader.canHandle(
          { deviceModelId: DeviceModelId.FLEX },
          SolanaContextTypes.TRANSACTION_CHECK,
        ),
      ).toBe(false);
    });
  });

  describe("loadField", () => {
    it("returns TRANSACTION_CHECK with descriptor and certificate on success", async () => {
      vi.spyOn(mockTxCheck, "getTransactionCheck").mockResolvedValue(
        Right({
          publicKeyId: "partner-key",
          descriptor: "0xabcd",
        }),
      );
      vi.spyOn(mockCert, "loadCertificate").mockResolvedValue({
        keyUsageNumber: 10,
        payload: new Uint8Array([1]),
      });

      const loader = makeLoader();
      const result = await loader.loadField(baseContext());

      expect(mockTxCheck.getTransactionCheck).toHaveBeenCalledWith({
        kind: "solana",
        from: fromB58,
        rawTx: rawB58,
        chain: 1,
        domain: undefined,
        block: undefined,
      });
      expect(mockCert.loadCertificate).toHaveBeenCalledWith({
        keyId: "partner-key",
        keyUsage: KeyUsage.TxSimulationSigner,
        targetDevice: DeviceModelId.FLEX,
      });
      expect(result).toEqual({
        type: SolanaContextTypes.TRANSACTION_CHECK,
        payload: { descriptor: "0xabcd" },
        certificate: { keyUsageNumber: 10, payload: new Uint8Array([1]) },
      });
    });

    it("returns ERROR when getTransactionCheck fails", async () => {
      const err = new Error("network");
      vi.spyOn(mockTxCheck, "getTransactionCheck").mockResolvedValue(Left(err));

      const loader = makeLoader();
      const result = await loader.loadField(baseContext());

      expect(result).toEqual({
        type: SolanaContextTypes.ERROR,
        error: err,
      });
      expect(mockCert.loadCertificate).not.toHaveBeenCalled();
    });
  });
});
