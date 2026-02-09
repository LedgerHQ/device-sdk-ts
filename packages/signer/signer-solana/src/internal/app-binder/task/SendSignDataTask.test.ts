import {
  APDU_MAX_PAYLOAD,
  ByteArrayBuilder,
  CommandResultFactory,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { DerivationPathUtils } from "@ledgerhq/signer-utils";
import { Just, Nothing } from "purify-ts";

import { SignTransactionCommand } from "@internal/app-binder/command/SignTransactionCommand";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";
import { SignDataTask } from "@internal/app-binder/task/SendSignDataTask";

import { type ChunkableCommandArgs } from "./SendCommandInChunksTask";

const DERIVATION_PATH = "44'/501'/0'/0'";
const PATH_SIZE = 4;

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
};

describe("SignDataTask", () => {
  const apiMock = makeDeviceActionInternalApiMock();
  const signature = new Uint8Array([
    0x12, 0x34, 0x56, 0x78, 0x90, 0xab, 0xcd, 0xef,
  ]);
  const resultOk = CommandResultFactory({ data: Just(signature) });
  const resultNothing = CommandResultFactory({ data: Nothing });

  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe("run with SignTransactionCommand", () => {
    const SIMPLE_TRANSACTION = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
    const BIG_TRANSACTION = new Uint8Array(new Array(500).fill(0x01));

    it("should send the transaction in a single command", async () => {
      // GIVEN-------------------------------
      //-------------------------------------
      const paths = DerivationPathUtils.splitPath(DERIVATION_PATH);
      const builder = new ByteArrayBuilder(
        SIMPLE_TRANSACTION.length + 2 + paths.length * PATH_SIZE,
      );
      builder.add8BitUIntToData(1);
      builder.add8BitUIntToData(paths.length);
      paths.forEach((path) => builder.add32BitUIntToData(path));
      builder.addBufferToData(SIMPLE_TRANSACTION);
      const EXPECTED_SIMPLE_TRANSACTION = builder.build();

      const args = {
        derivationPath: DERIVATION_PATH,
        sendingData: SIMPLE_TRANSACTION,
        commandFactory: (chunkArgs: ChunkableCommandArgs) =>
          new SignTransactionCommand({
            serializedTransaction: chunkArgs.chunkedData,
            more: chunkArgs.more,
            extend: chunkArgs.extend,
          }),
        logger: mockLogger,
      };
      apiMock.sendCommand.mockResolvedValueOnce(resultOk);

      // WHEN--------------------------------
      //-------------------------------------
      const result = await new SignDataTask(apiMock, args).run();

      // THEN--------------------------------
      //-------------------------------------
      expect(apiMock.sendCommand).toHaveBeenCalledTimes(1);
      expect(
        Array.from(
          (apiMock.sendCommand.mock.calls[0]?.[0] as SignTransactionCommand)
            ?.args?.serializedTransaction || [],
        ),
      ).toEqual(Array.from(EXPECTED_SIMPLE_TRANSACTION));

      if (isSuccessCommandResult(result)) {
        expect(result.data).toEqual(Just(signature));
      } else {
        assert.fail(
          `Expected a successful result, but got an error: ${result.error}`,
        );
      }
    });

    it("should send the transaction in chunks", async () => {
      // GIVEN-------------------------------
      //-------------------------------------
      const paths = DerivationPathUtils.splitPath(DERIVATION_PATH);
      const builder = new ByteArrayBuilder(
        BIG_TRANSACTION.length + 2 + paths.length * PATH_SIZE,
      );
      builder.add8BitUIntToData(1);
      builder.add8BitUIntToData(paths.length);
      paths.forEach((path) => builder.add32BitUIntToData(path));
      builder.addBufferToData(BIG_TRANSACTION);
      const dataBuffer = builder.build();

      const EXPECTED_BIG_TRANSACTION_CHUNK_1 = dataBuffer.slice(
        0,
        APDU_MAX_PAYLOAD,
      );
      const EXPECTED_BIG_TRANSACTION_CHUNK_2 = dataBuffer.slice(
        APDU_MAX_PAYLOAD,
        APDU_MAX_PAYLOAD * 2,
      );
      const EXPECTED_BIG_TRANSACTION_CHUNK_3 = dataBuffer.slice(
        APDU_MAX_PAYLOAD * 2,
        APDU_MAX_PAYLOAD * 3,
      );

      const args = {
        derivationPath: DERIVATION_PATH,
        sendingData: BIG_TRANSACTION,
        commandFactory: (chunkArgs: ChunkableCommandArgs) =>
          new SignTransactionCommand({
            serializedTransaction: chunkArgs.chunkedData,
            more: chunkArgs.more,
            extend: chunkArgs.extend,
          }),
        logger: mockLogger,
      };
      apiMock.sendCommand
        .mockResolvedValueOnce(resultNothing)
        .mockResolvedValueOnce(resultNothing)
        .mockResolvedValueOnce(resultOk);

      // WHEN--------------------------------
      //-------------------------------------
      const result = await new SignDataTask(apiMock, args).run();

      // THEN--------------------------------
      //-------------------------------------
      expect(apiMock.sendCommand).toHaveBeenCalledTimes(3);
      expect(apiMock.sendCommand).toHaveBeenNthCalledWith(
        1,
        expect.objectContaining({
          args: {
            serializedTransaction: EXPECTED_BIG_TRANSACTION_CHUNK_1,
            extend: false,
            more: true,
          },
        }),
      );
      expect(apiMock.sendCommand).toHaveBeenNthCalledWith(
        2,
        expect.objectContaining({
          args: {
            serializedTransaction: EXPECTED_BIG_TRANSACTION_CHUNK_2,
            extend: true,
            more: true,
          },
        }),
      );

      expect(apiMock.sendCommand).toHaveBeenNthCalledWith(
        3,
        expect.objectContaining({
          args: {
            serializedTransaction: EXPECTED_BIG_TRANSACTION_CHUNK_3,
            extend: true,
            more: false,
          },
        }),
      );

      if (isSuccessCommandResult(result)) {
        expect(result.data).toEqual(Just(signature));
      } else {
        assert.fail(
          `Expected a successful result, but got an error: ${result.error}`,
        );
      }
    });

    it("should return an error if the command fails", async () => {
      // GIVEN-------------------------------
      //-------------------------------------
      const paths = DerivationPathUtils.splitPath(DERIVATION_PATH);
      const builder = new ByteArrayBuilder(
        SIMPLE_TRANSACTION.length + 2 + paths.length * PATH_SIZE,
      );
      builder.add8BitUIntToData(1);
      builder.add8BitUIntToData(paths.length);
      paths.forEach((path) => builder.add32BitUIntToData(path));
      builder.addBufferToData(SIMPLE_TRANSACTION);

      const args = {
        derivationPath: DERIVATION_PATH,
        sendingData: SIMPLE_TRANSACTION,
        commandFactory: (chunkArgs: ChunkableCommandArgs) =>
          new SignTransactionCommand({
            serializedTransaction: chunkArgs.chunkedData,
            more: chunkArgs.more,
            extend: chunkArgs.extend,
          }),
        logger: mockLogger,
      };
      apiMock.sendCommand.mockResolvedValueOnce(
        CommandResultFactory({
          error: new InvalidStatusWordError("no signature returned"),
        }),
      );

      // WHEN--------------------------------
      //-------------------------------------
      const result = await new SignDataTask(apiMock, args).run();

      // THEN--------------------------------
      //-------------------------------------
      expect(apiMock.sendCommand).toHaveBeenCalledTimes(1);
      expect(result).toMatchObject({
        error: new InvalidStatusWordError("no signature returned"),
      });
    });

    it("should return an error if a chunk command fails", async () => {
      // GIVEN-------------------------------
      //-------------------------------------
      const paths = DerivationPathUtils.splitPath(DERIVATION_PATH);
      const builder = new ByteArrayBuilder(
        BIG_TRANSACTION.length + 2 + paths.length * PATH_SIZE,
      );
      builder.add8BitUIntToData(1);
      builder.add8BitUIntToData(paths.length);
      paths.forEach((path) => builder.add32BitUIntToData(path));
      builder.addBufferToData(BIG_TRANSACTION);

      const args = {
        derivationPath: DERIVATION_PATH,
        sendingData: BIG_TRANSACTION,
        commandFactory: (chunkArgs: ChunkableCommandArgs) =>
          new SignTransactionCommand({
            serializedTransaction: chunkArgs.chunkedData,
            more: chunkArgs.more,
            extend: chunkArgs.extend,
          }),
        logger: mockLogger,
      };
      apiMock.sendCommand
        .mockResolvedValueOnce(resultNothing)
        .mockResolvedValueOnce(
          CommandResultFactory({
            error: new InvalidStatusWordError("An error occurred"),
          }),
        );

      // WHEN--------------------------------
      //-------------------------------------
      const result = await new SignDataTask(apiMock, args).run();

      // THEN--------------------------------
      //-------------------------------------
      expect(apiMock.sendCommand).toHaveBeenCalledTimes(2);
      expect(result).toMatchObject({
        error: new InvalidStatusWordError("An error occurred"),
      });
    });
  });
});
