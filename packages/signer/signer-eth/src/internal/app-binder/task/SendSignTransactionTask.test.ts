import {
  APDU_MAX_PAYLOAD,
  CommandResultFactory,
  hexaStringToBuffer,
  InvalidStatusWordError,
} from "@ledgerhq/device-management-kit";
import { Transaction } from "ethers";
import { Just, Nothing } from "purify-ts";

import { ClearSigningType } from "@api/model/ClearSigningType";
import { SignTransactionCommand } from "@internal/app-binder/command/SignTransactionCommand";
import { StartTransactionCommand } from "@internal/app-binder/command/StartTransactionCommand";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";

import { SendSignTransactionTask } from "./SendSignTransactionTask";

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
};

const PATH = new Uint8Array([
  0x05, 0x80, 0x00, 0x00, 0x2c, 0x80, 0x00, 0x00, 0x3c, 0x80, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);

const SIMPLE_TRANSACTION = new Uint8Array([
  0x05, 0x80, 0x00, 0x00, 0x2c, 0x80, 0x00, 0x00, 0x3c, 0x80, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xf8, 0x6b, 0x82, 0x06, 0x7e,
  0x84, 0x57, 0x19, 0x13, 0x1f, 0x83, 0x01, 0x10, 0x68, 0x94, 0xda, 0xc1, 0x7f,
  0x95, 0x8d, 0x2e, 0xe5, 0x23, 0xa2, 0x20, 0x62, 0x06, 0x99, 0x45, 0x97, 0xc1,
  0x3d, 0x83, 0x1e, 0xc7, 0x80, 0xb8, 0x44, 0xa9, 0x05, 0x9c, 0xbb, 0x00, 0x00,
]);

const BIG_TRANSACTION = new Uint8Array([
  0xf9, 0x08, 0xaf, 0x26, 0x85, 0x01, 0xb2, 0x3d, 0x94, 0x83, 0x83, 0x05, 0xc1,
  0xfc, 0x94, 0xde, 0xf1, 0xc0, 0xde, 0xd9, 0xbe, 0xc7, 0xf1, 0xa1, 0x67, 0x08,
  0x19, 0x83, 0x32, 0x40, 0xf0, 0x27, 0xb2, 0x5e, 0xff, 0x80, 0xb9, 0x08, 0x88,
  0x41, 0x55, 0x65, 0xb0, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x1f, 0x98, 0x40, 0xa8, 0x5d, 0x5a, 0xf5, 0xbf, 0x1d, 0x17,
  0x62, 0xf9, 0x25, 0xbd, 0xad, 0xdc, 0x42, 0x01, 0xf9, 0x84, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xa0, 0xb8, 0x69, 0x91,
  0xc6, 0x21, 0x8b, 0x36, 0xc1, 0xd1, 0x9d, 0x4a, 0x2e, 0x9e, 0xb0, 0xce, 0x36,
  0x06, 0xeb, 0x48, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x61, 0xe9, 0x33, 0x59, 0x53, 0x95, 0x6c, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x03, 0x33,
  0xef, 0x12, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0xa0, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x04, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x80, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x04, 0x40,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x05, 0x40, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x06, 0x40, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x21, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x40, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x03, 0x60, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
]);

describe("SendSignTransactionTask", () => {
  const apiMock = makeDeviceActionInternalApiMock();
  const signature = {
    v: 27,
    r: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
    s: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  };
  const resultOk = CommandResultFactory({
    data: Just(signature),
  });
  const resultNothing = CommandResultFactory({ data: Nothing });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("run", () => {
    it("should send the transaction in one command", async () => {
      // GIVEN
      const args = {
        derivationPath: "44'/60'/0'/0/0",
        serializedTransaction: SIMPLE_TRANSACTION,
        chainId: 1,
        transactionType: 1,
        clearSigningType: ClearSigningType.BASIC,
        logger: mockLogger,
      };
      apiMock.sendCommand.mockResolvedValueOnce(resultOk);

      // WHEN
      const result = await new SendSignTransactionTask(apiMock, args).run();

      // THEN
      expect(apiMock.sendCommand.mock.calls).toHaveLength(1);
      expect(apiMock.sendCommand.mock.calls[0]![0]).toStrictEqual(
        new SignTransactionCommand({
          serializedTransaction: new Uint8Array([
            ...PATH,
            ...SIMPLE_TRANSACTION,
          ]),
          isFirstChunk: true,
        }),
      );
      // eslint-disable-next-line  @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      expect((result as any).data).toStrictEqual(signature);
    });

    it("Generic-parser transaction should be signed without payload", async () => {
      // GIVEN
      const args = {
        derivationPath: "44'/60'/0'/0/0",
        serializedTransaction: SIMPLE_TRANSACTION,
        chainId: 1,
        transactionType: 1,
        clearSigningType: ClearSigningType.EIP7730,
        logger: mockLogger,
      };
      apiMock.sendCommand.mockResolvedValueOnce(resultOk);

      // WHEN
      const result = await new SendSignTransactionTask(apiMock, args).run();

      // THEN
      expect(apiMock.sendCommand.mock.calls).toHaveLength(1);
      expect(apiMock.sendCommand.mock.calls[0]![0]).toStrictEqual(
        new StartTransactionCommand(),
      );
      // eslint-disable-next-line  @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      expect((result as any).data).toStrictEqual(signature);
    });

    it("should send the transaction in chunks", async () => {
      // GIVEN
      const args = {
        derivationPath: "44'/60'/0'/0/0",
        serializedTransaction: BIG_TRANSACTION,
        chainId: 1,
        transactionType: 1,
        clearSigningType: ClearSigningType.BASIC,
        logger: mockLogger,
      };
      apiMock.sendCommand.mockResolvedValueOnce(resultNothing);
      apiMock.sendCommand.mockResolvedValueOnce(resultOk);

      // WHEN
      const result = await new SendSignTransactionTask(apiMock, args).run();

      // THEN
      expect(apiMock.sendCommand.mock.calls).toHaveLength(2);
      expect(apiMock.sendCommand.mock.calls[0]![0]).toStrictEqual(
        new SignTransactionCommand({
          serializedTransaction: new Uint8Array([
            ...PATH,
            ...BIG_TRANSACTION,
          ]).slice(0, APDU_MAX_PAYLOAD),
          isFirstChunk: true,
        }),
      );
      expect(apiMock.sendCommand.mock.calls[1]![0]).toStrictEqual(
        new SignTransactionCommand({
          serializedTransaction: new Uint8Array([
            ...PATH,
            ...BIG_TRANSACTION,
          ]).slice(APDU_MAX_PAYLOAD, APDU_MAX_PAYLOAD * 2),
          isFirstChunk: false,
        }),
      );
      // eslint-disable-next-line  @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      expect((result as any).data).toStrictEqual(signature);
    });

    it.each([
      [458, 127, 254],
      [458, 0x818181818181, 254],
      [452, 0x818181818181, 251],
    ])(
      "should prevent chunking legacy transactions just before the [r,s,v] for dataSize %i, chainId %i",
      async (dataSize, chainId, chunkSize) => {
        // GIVEN
        const transaction = new Transaction();
        transaction.to = "0x0123456789abcdef0123456789abcdef01234567";
        transaction.nonce = 0;
        transaction.value = 0n;
        transaction.gasLimit = 1n;
        transaction.gasPrice = 2n;
        transaction.data = "0x" + new Array(dataSize).fill("00").join("");
        transaction.chainId = chainId;
        transaction.type = 0;
        const serialized = hexaStringToBuffer(transaction.unsignedSerialized)!;
        const args = {
          derivationPath: "44'/60'/0'/0/0",
          serializedTransaction: serialized,
          chainId,
          transactionType: 0,
          clearSigningType: ClearSigningType.BASIC,
          logger: mockLogger,
        };
        apiMock.sendCommand.mockResolvedValueOnce(resultNothing);
        apiMock.sendCommand.mockResolvedValueOnce(resultNothing);
        apiMock.sendCommand.mockResolvedValue(resultOk);

        // WHEN
        await new SendSignTransactionTask(apiMock, args).run();

        // THEN
        const payload = Uint8Array.from([...PATH, ...serialized]);
        expect(apiMock.sendCommand.mock.calls).toHaveLength(3);
        expect(apiMock.sendCommand.mock.calls[0]![0]).toStrictEqual(
          new SignTransactionCommand({
            serializedTransaction: payload.slice(0, chunkSize),
            isFirstChunk: true,
          }),
        );
        expect(apiMock.sendCommand.mock.calls[1]![0]).toStrictEqual(
          new SignTransactionCommand({
            serializedTransaction: payload.slice(chunkSize, chunkSize * 2),
            isFirstChunk: false,
          }),
        );
        expect(apiMock.sendCommand.mock.calls[2]![0]).toStrictEqual(
          new SignTransactionCommand({
            serializedTransaction: payload.slice(chunkSize * 2),
            isFirstChunk: false,
          }),
        );
      },
    );

    it("should return an error if the command fails", async () => {
      // GIVEN
      const args = {
        derivationPath: "44'/60'/0'/0/0",
        serializedTransaction: SIMPLE_TRANSACTION,
        chainId: 1,
        transactionType: 1,
        clearSigningType: ClearSigningType.BASIC,
        logger: mockLogger,
      };
      apiMock.sendCommand.mockResolvedValueOnce(resultNothing);

      // WHEN
      const result = await new SendSignTransactionTask(apiMock, args).run();

      // THEN
      expect(apiMock.sendCommand.mock.calls).toHaveLength(1);
      expect(apiMock.sendCommand.mock.calls[0]![0]).toStrictEqual(
        new SignTransactionCommand({
          serializedTransaction: new Uint8Array([
            ...PATH,
            ...SIMPLE_TRANSACTION,
          ]),
          isFirstChunk: true,
        }),
      );
      // eslint-disable-next-line  @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      expect((result as any).error).toStrictEqual(
        new InvalidStatusWordError("no signature returned"),
      );
    });

    it("should return an error if the generic-parser command fails", async () => {
      // GIVEN
      const args = {
        derivationPath: "44'/60'/0'/0/0",
        serializedTransaction: SIMPLE_TRANSACTION,
        chainId: 1,
        transactionType: 1,
        clearSigningType: ClearSigningType.EIP7730,
        logger: mockLogger,
      };
      apiMock.sendCommand.mockResolvedValueOnce(resultNothing);

      // WHEN
      const result = await new SendSignTransactionTask(apiMock, args).run();

      // THEN
      expect(apiMock.sendCommand.mock.calls).toHaveLength(1);
      expect(apiMock.sendCommand.mock.calls[0]![0]).toStrictEqual(
        new StartTransactionCommand(),
      );
      // eslint-disable-next-line  @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      expect((result as any).error).toStrictEqual(
        new InvalidStatusWordError("no signature returned"),
      );
    });

    it("should return an error if the command fails in the middle of the transaction", async () => {
      // GIVEN
      const args = {
        derivationPath: "44'/60'/0'/0/0",
        serializedTransaction: BIG_TRANSACTION,
        chainId: 1,
        transactionType: 1,
        clearSigningType: ClearSigningType.BASIC,
        logger: mockLogger,
      };
      apiMock.sendCommand.mockResolvedValueOnce(resultNothing);
      apiMock.sendCommand.mockResolvedValueOnce(
        CommandResultFactory({
          error: new InvalidStatusWordError("An error"),
        }),
      );

      // WHEN
      const result = await new SendSignTransactionTask(apiMock, args).run();

      // THEN
      expect(apiMock.sendCommand.mock.calls).toHaveLength(2);
      expect(apiMock.sendCommand.mock.calls[0]![0]).toStrictEqual(
        new SignTransactionCommand({
          serializedTransaction: new Uint8Array([
            ...PATH,
            ...BIG_TRANSACTION,
          ]).slice(0, APDU_MAX_PAYLOAD),
          isFirstChunk: true,
        }),
      );
      expect(apiMock.sendCommand.mock.calls[1]![0]).toStrictEqual(
        new SignTransactionCommand({
          serializedTransaction: new Uint8Array([
            ...PATH,
            ...BIG_TRANSACTION,
          ]).slice(APDU_MAX_PAYLOAD, APDU_MAX_PAYLOAD * 2),
          isFirstChunk: false,
        }),
      );
      // eslint-disable-next-line  @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      expect((result as any).error).toStrictEqual(
        new InvalidStatusWordError("An error"),
      );
    });

    it("legacy transaction with small chainId", async () => {
      // GIVEN
      const args = {
        derivationPath: "44'/60'/0'/0/0",
        serializedTransaction: SIMPLE_TRANSACTION,
        chainId: 56,
        transactionType: 0,
        clearSigningType: ClearSigningType.BASIC,
        logger: mockLogger,
      };
      apiMock.sendCommand.mockResolvedValueOnce(
        CommandResultFactory({
          data: Just({
            v: 147,
            r: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
            s: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
          }),
        }),
      );

      // WHEN
      const result = await new SendSignTransactionTask(apiMock, args).run();

      // THEN
      // eslint-disable-next-line  @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      expect((result as any).data.v).toStrictEqual(147);
    });

    it("legacy transaction with small chainId with positive parity", async () => {
      // GIVEN
      const args = {
        derivationPath: "44'/60'/0'/0/0",
        serializedTransaction: SIMPLE_TRANSACTION,
        chainId: 56,
        transactionType: 0,
        clearSigningType: ClearSigningType.BASIC,
        logger: mockLogger,
      };
      apiMock.sendCommand.mockResolvedValueOnce(
        CommandResultFactory({
          data: Just({
            v: 148,
            r: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
            s: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
          }),
        }),
      );

      // WHEN
      const result = await new SendSignTransactionTask(apiMock, args).run();

      // THEN
      // eslint-disable-next-line  @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      expect((result as any).data.v).toStrictEqual(148);
    });

    it("legacy transaction with big chainId", async () => {
      // GIVEN
      const args = {
        derivationPath: "44'/60'/0'/0/0",
        serializedTransaction: SIMPLE_TRANSACTION,
        chainId: 11297108109,
        transactionType: 0,
        clearSigningType: ClearSigningType.BASIC,
        logger: mockLogger,
      };
      apiMock.sendCommand.mockResolvedValueOnce(
        CommandResultFactory({
          data: Just({
            v: 131,
            r: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
            s: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
          }),
        }),
      );

      // WHEN
      const result = await new SendSignTransactionTask(apiMock, args).run();

      // THEN
      // eslint-disable-next-line  @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      expect((result as any).data.v).toStrictEqual(22594216253);
    });

    it("legacy transaction with big chainId with positive parity", async () => {
      // GIVEN
      const args = {
        derivationPath: "44'/60'/0'/0/0",
        serializedTransaction: SIMPLE_TRANSACTION,
        chainId: 11297108109,
        transactionType: 0,
        clearSigningType: ClearSigningType.BASIC,
        logger: mockLogger,
      };
      apiMock.sendCommand.mockResolvedValueOnce(
        CommandResultFactory({
          data: Just({
            v: 132,
            r: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
            s: "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
          }),
        }),
      );

      // WHEN
      const result = await new SendSignTransactionTask(apiMock, args).run();

      // THEN
      // eslint-disable-next-line  @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
      expect((result as any).data.v).toStrictEqual(22594216254);
    });
  });
});
