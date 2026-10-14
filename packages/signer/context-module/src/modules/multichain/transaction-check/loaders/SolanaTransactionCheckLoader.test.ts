/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { DeviceModelId } from "@ledgerhq/device-management-kit";
import bs58 from "bs58";
import { Left, Right } from "purify-ts";

import { type PkiCertificateLoader } from "@/modules/multichain/pki/domain/PkiCertificateLoader";
import { type TransactionCheckDataSource } from "@/modules/multichain/transaction-check/data/TransactionCheckDataSource";
import { TransactionCheckPaths } from "@/modules/multichain/transaction-check/utils/constants";
import { SolanaTransactionScanChainId } from "@/modules/solana/model/SolanaTransactionScanChainId";
import { ClearSignContextType } from "@/shared/model/ClearSignContext";

import { SolanaTransactionCheckLoader } from "./SolanaTransactionCheckLoader";

const loggerMock = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
};
const loggerFactory = () => loggerMock;

const certificateLoaderMock: PkiCertificateLoader = {
  loadCertificate: vi.fn(),
};

let dataSourceMock: { check: ReturnType<typeof vi.fn> };
let loader: SolanaTransactionCheckLoader;

beforeEach(() => {
  vi.resetAllMocks();
  dataSourceMock = { check: vi.fn() };
  loader = new SolanaTransactionCheckLoader(
    dataSourceMock as unknown as TransactionCheckDataSource,
    certificateLoaderMock,
    loggerFactory,
  );
});

describe("SolanaTransactionCheckLoader", () => {
  describe("canHandle", () => {
    const validInput = {
      deviceModelId: DeviceModelId.NANO_X,
      transactionCheck: {
        from: "signer",
        transactionBytes: new Uint8Array([1, 0, 3, 0xde]),
        chain: 1,
      },
    };

    it("returns true for a valid Solana transaction-check input", () => {
      expect(
        loader.canHandle(validInput, [
          ClearSignContextType.SOLANA_TRANSACTION_CHECK,
        ]),
      ).toBe(true);
    });

    it("returns false when expected types do not include SOLANA_TRANSACTION_CHECK", () => {
      expect(
        loader.canHandle(validInput, [ClearSignContextType.SOLANA_TOKEN]),
      ).toBe(false);
    });

    it("returns false when transactionBytes is not a Uint8Array", () => {
      expect(
        loader.canHandle(
          {
            ...validInput,
            transactionCheck: {
              ...validInput.transactionCheck,
              transactionBytes: "0xdead" as unknown as Uint8Array,
            },
          },
          [ClearSignContextType.SOLANA_TRANSACTION_CHECK],
        ),
      ).toBe(false);
    });

    it("returns false when transactionBytes is empty", () => {
      expect(
        loader.canHandle(
          {
            ...validInput,
            transactionCheck: {
              ...validInput.transactionCheck,
              transactionBytes: new Uint8Array(),
            },
          },
          [ClearSignContextType.SOLANA_TRANSACTION_CHECK],
        ),
      ).toBe(false);
    });

    it("returns false when from is empty", () => {
      expect(
        loader.canHandle(
          {
            ...validInput,
            transactionCheck: { ...validInput.transactionCheck, from: "" },
          },
          [ClearSignContextType.SOLANA_TRANSACTION_CHECK],
        ),
      ).toBe(false);
    });

    it("returns false for unsupported device models (NANO_S)", () => {
      expect(
        loader.canHandle(
          { ...validInput, deviceModelId: DeviceModelId.NANO_S },
          [ClearSignContextType.SOLANA_TRANSACTION_CHECK],
        ),
      ).toBe(false);
    });
  });

  describe("load — wire format", () => {
    beforeEach(() => {
      dataSourceMock.check.mockResolvedValue(
        Right({ publicKeyId: "pk", descriptor: "aabb" }),
      );
      (certificateLoaderMock.loadCertificate as any).mockResolvedValue({
        payload: new Uint8Array([0xcc]),
        keyUsageNumber: 14,
      });
    });

    it("bs58-encodes transactionBytes and passes it to the data source", async () => {
      const transactionBytes = new Uint8Array([0xaa, 0xbb, 0xcc, 0xdd]);

      await loader.load({
        deviceModelId: DeviceModelId.NANO_X,
        transactionCheck: {
          from: "signer",
          transactionBytes,
          chain: SolanaTransactionScanChainId.MAINNET,
        },
      });

      const sent = dataSourceMock.check.mock.calls[0]![0];
      expect(sent.path).toBe(TransactionCheckPaths.SOLANA_TRANSACTION);
      expect(sent.body.tx.from).toBe("signer");
      expect(sent.body.chain).toBe(SolanaTransactionScanChainId.MAINNET);
      expect(sent.body.tx.raw).toBe(bs58.encode(transactionBytes));
    });
  });

  describe("load — v1 (SIMD-0385) transactions", () => {
    // The spec's 172-byte v1 message followed by its one signature: 236 bytes.
    const SPEC_V1_TRANSACTION = Uint8Array.from([
      ...Buffer.from(
        "810100010f000000" +
          "aa".repeat(32) +
          "0103" +
          "11".repeat(32) +
          "22".repeat(32) +
          "00".repeat(32) +
          "8813000000000000c20100000080000002020c0000010200000040420f0000000000",
        "hex",
      ),
      ...new Uint8Array(64).fill(0x44),
    ]);
    // The v1 size limit. The loader never parses the bytes, so filler is enough.
    const MAX_SIZE_V1_TRANSACTION = Uint8Array.from({ length: 4096 }, (_, i) =>
      i === 0 ? 0x81 : i & 0xff,
    );

    beforeEach(() => {
      dataSourceMock.check.mockResolvedValue(
        Right({ publicKeyId: "pk", descriptor: "aabb" }),
      );
    });

    it.each([
      ["the 236-byte spec", SPEC_V1_TRANSACTION],
      ["a 4096-byte", MAX_SIZE_V1_TRANSACTION],
    ])(
      "sends %s v1 wire transaction unchanged",
      async (_, transactionBytes) => {
        await loader.load({
          deviceModelId: DeviceModelId.NANO_X,
          transactionCheck: {
            from: "signer",
            transactionBytes,
            chain: SolanaTransactionScanChainId.MAINNET,
          },
        });

        const sent = dataSourceMock.check.mock.calls[0]![0];
        expect(sent.path).toBe(TransactionCheckPaths.SOLANA_TRANSACTION);
        const raw = bs58.decode(sent.body.tx.raw);
        expect(raw[0]).toBe(0x81);
        expect(raw).toEqual(transactionBytes);
      },
    );
  });

  describe("load — result mapping", () => {
    it("returns a SOLANA_TRANSACTION_CHECK context with descriptor and certificate on success", async () => {
      dataSourceMock.check.mockResolvedValue(
        Right({ publicKeyId: "pk-1", descriptor: "deadbeef" }),
      );
      const cert = { payload: new Uint8Array([0x99]), keyUsageNumber: 14 };
      (certificateLoaderMock.loadCertificate as any).mockResolvedValue(cert);

      const [ctx] = await loader.load({
        deviceModelId: DeviceModelId.NANO_X,
        transactionCheck: {
          from: "signer",
          transactionBytes: new Uint8Array([1, 0, 3, 0xaa]),
          chain: SolanaTransactionScanChainId.MAINNET,
        },
      });

      expect(ctx).toEqual({
        type: ClearSignContextType.SOLANA_TRANSACTION_CHECK,
        payload: { descriptor: "deadbeef" },
        certificate: cert,
      });
    });

    it("returns an ERROR context when the data source returns Left", async () => {
      const error = new Error("network fail");
      dataSourceMock.check.mockResolvedValue(Left(error));

      const [ctx] = await loader.load({
        deviceModelId: DeviceModelId.NANO_X,
        transactionCheck: {
          from: "signer",
          transactionBytes: new Uint8Array([1, 0, 3, 0xaa]),
          chain: SolanaTransactionScanChainId.MAINNET,
        },
      });

      expect(ctx).toEqual({ type: ClearSignContextType.ERROR, error });
      expect(certificateLoaderMock.loadCertificate).not.toHaveBeenCalled();
    });
  });
});
