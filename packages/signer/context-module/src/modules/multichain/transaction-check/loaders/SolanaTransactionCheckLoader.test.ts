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

    it("wraps a legacy message with zero-filled signature placeholders before bs58-encoding", async () => {
      // message[0] = 2 → numRequiredSignatures = 2 (legacy, high bit clear)
      const message = new Uint8Array([2, 0, 3, 0xaa, 0xbb, 0xcc]);
      // expected: compact-u16(2) + 2*64 zero bytes + message
      const expected = new Uint8Array(1 + 2 * 64 + message.length);
      expected[0] = 2; // compact-u16 encoding of 2
      expected.set(message, 1 + 2 * 64);

      await loader.load({
        deviceModelId: DeviceModelId.NANO_X,
        transactionCheck: {
          from: "signer",
          transactionBytes: message,
          chain: SolanaTransactionScanChainId.MAINNET,
        },
      });

      const sent = dataSourceMock.check.mock.calls[0]![0];

      expect(sent.path).toBe(TransactionCheckPaths.SOLANA_TRANSACTION);
      expect(sent.body.tx.from).toBe("signer");
      expect(sent.body.chain).toBe(SolanaTransactionScanChainId.MAINNET);
      expect(Array.from(bs58.decode(sent.body.tx.raw))).toEqual(
        Array.from(expected),
      );
      expect(sent.body.tx.raw).toBe(bs58.encode(expected));
    });

    it("wraps a versioned (v0) message with signature placeholders", async () => {
      // message[0] = 0x80 → versioned prefix; message[1] = 1 → numRequiredSignatures = 1
      const message = new Uint8Array([0x80, 1, 0, 3, 0xde, 0xad]);
      // expected: compact-u16(1) + 1*64 zero bytes + message
      const expected = new Uint8Array(1 + 1 * 64 + message.length);
      expected[0] = 1; // compact-u16 encoding of 1
      expected.set(message, 1 + 1 * 64);

      await loader.load({
        deviceModelId: DeviceModelId.NANO_X,
        transactionCheck: {
          from: "signer",
          transactionBytes: message,
          chain: SolanaTransactionScanChainId.MAINNET,
        },
      });

      const raw = dataSourceMock.check.mock.calls[0]![0].body.tx.raw;

      expect(Array.from(bs58.decode(raw))).toEqual(Array.from(expected));
    });
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

    it("returns an ERROR context when numRequiredSignatures exceeds the 64-signature limit", async () => {
      // message[0] = 65 → numRequiredSignatures = 65 (legacy, high bit clear), which exceeds SOLANA_MAX_SIGNATURES
      const message = new Uint8Array([65, 0, 3, 0xaa]);

      const [ctx] = await loader.load({
        deviceModelId: DeviceModelId.NANO_X,
        transactionCheck: {
          from: "signer",
          transactionBytes: message,
          chain: SolanaTransactionScanChainId.MAINNET,
        },
      });

      expect(ctx).toMatchObject({
        type: ClearSignContextType.ERROR,
        error: expect.objectContaining({
          message: expect.stringContaining("exceeds SOLANA_MAX_SIGNATURES"),
        }),
      });
      expect(dataSourceMock.check).not.toHaveBeenCalled();
    });
  });
});
