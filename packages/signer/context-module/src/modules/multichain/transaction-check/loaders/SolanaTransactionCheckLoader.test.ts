/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { DeviceModelId } from "@ledgerhq/device-management-kit";
import bs58 from "bs58";
import { Left, Right } from "purify-ts";

import { type PkiCertificateLoader } from "@/modules/multichain/pki/domain/PkiCertificateLoader";
import { type TransactionCheckDataSource } from "@/modules/multichain/transaction-check/data/TransactionCheckDataSource";
import { TransactionCheckPaths } from "@/modules/multichain/transaction-check/utils/constants";
import { ClearSignContextType } from "@/shared/model/ClearSignContext";

import { SolanaTransactionCheckLoader } from "./SolanaTransactionCheckLoader";

const SIG_LENGTH = 64;

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

    it("wraps a legacy Message into a serialized Transaction (sig count + zero-filled signatures + message) and bs58-encodes it", async () => {
      // Legacy message: numRequiredSignatures=2, then arbitrary bytes
      const message = new Uint8Array([2, 0, 3, 0xaa, 0xbb, 0xcc]);

      await loader.load({
        deviceModelId: DeviceModelId.NANO_X,
        transactionCheck: {
          from: "signer",
          transactionBytes: message,
          chain: 1,
        },
      });

      const sent = dataSourceMock.check.mock.calls[0]![0];
      const wrapped = bs58.decode(sent.body.tx.raw);

      expect(sent.path).toBe(TransactionCheckPaths.SOLANA_TRANSACTION);
      expect(sent.body.tx.from).toBe("signer");
      expect(sent.body.chain).toBe(1);
      expect(wrapped.length).toBe(1 + 2 * SIG_LENGTH + message.length);
      expect(wrapped[0]).toBe(2);
      expect(Array.from(wrapped.slice(1, 1 + 2 * SIG_LENGTH))).toEqual(
        new Array(2 * SIG_LENGTH).fill(0),
      );
      expect(Array.from(wrapped.slice(1 + 2 * SIG_LENGTH))).toEqual(
        Array.from(message),
      );
    });

    it("wraps a versioned (v0) Message by skipping the version prefix when reading numRequiredSignatures", async () => {
      // V0 message: [0x80 version prefix, numRequiredSignatures=1, ...]
      const message = new Uint8Array([0x80, 1, 0, 3, 0xde, 0xad]);

      await loader.load({
        deviceModelId: DeviceModelId.NANO_X,
        transactionCheck: {
          from: "signer",
          transactionBytes: message,
          chain: 1,
        },
      });

      const wrapped = bs58.decode(
        dataSourceMock.check.mock.calls[0]![0].body.tx.raw,
      );

      expect(wrapped.length).toBe(1 + SIG_LENGTH + message.length);
      expect(wrapped[0]).toBe(1);
      expect(Array.from(wrapped.slice(1, 1 + SIG_LENGTH))).toEqual(
        new Array(SIG_LENGTH).fill(0),
      );
      expect(Array.from(wrapped.slice(1 + SIG_LENGTH))).toEqual(
        Array.from(message),
      );
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
          chain: 1,
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
          chain: 1,
        },
      });

      expect(ctx).toEqual({ type: ClearSignContextType.ERROR, error });
      expect(certificateLoaderMock.loadCertificate).not.toHaveBeenCalled();
    });

    it("returns an ERROR context (and does not call the data source) when numRequiredSignatures exceeds the max", async () => {
      // numRequiredSignatures = 65, one above SOLANA_MAX_SIGNATURES (64)
      const message = new Uint8Array([65, 0, 3, 0xaa]);

      const [ctx] = await loader.load({
        deviceModelId: DeviceModelId.NANO_X,
        transactionCheck: {
          from: "signer",
          transactionBytes: message,
          chain: 1,
        },
      });

      expect(ctx).toMatchObject({
        type: ClearSignContextType.ERROR,
        error: expect.any(Error),
      });
      expect((ctx as { error: Error }).error.message).toContain(
        "numRequiredSignatures (65)",
      );
      expect(dataSourceMock.check).not.toHaveBeenCalled();
    });
  });
});
