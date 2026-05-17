import {
  CommandResultFactory,
  CommandResultStatus,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  PolkadotAppCommandError,
  PolkadotErrorCodes,
} from "@internal/app-binder/command/utils/polkadotApplicationErrors";
import { SignTransactionTask } from "@internal/app-binder/task/SignTransactionTask";

const BITTENSOR_PATH = "44'/1005'/0'/0'/0'";

describe("SignTransactionTask", () => {
  let sendCommandMock: ReturnType<typeof vi.fn>;
  let apiMock: InternalApi;
  let loggerMock: LoggerPublisherService;

  beforeEach(() => {
    sendCommandMock = vi.fn();
    apiMock = {
      sendCommand: sendCommandMock,
    } as unknown as InternalApi;
    loggerMock = {
      debug: vi.fn(),
    } as unknown as LoggerPublisherService;
  });

  describe("run", () => {
    it("should send INIT + LAST for small payload (blob + metadata < 255 bytes) and return signature", async () => {
      // ARRANGE
      const blob = new Uint8Array(50).fill(0x01);
      const metadata = new Uint8Array(40).fill(0x02);
      const signature = new Uint8Array(65).fill(0xee);

      sendCommandMock
        .mockResolvedValueOnce({ status: CommandResultStatus.Success }) // INIT
        .mockResolvedValueOnce(CommandResultFactory({ data: signature })); // LAST

      const task = new SignTransactionTask(
        apiMock,
        { derivationPath: BITTENSOR_PATH, blob, metadata },
        loggerMock,
      );

      // ACT
      const result = await task.run();

      // ASSERT
      expect(sendCommandMock).toHaveBeenCalledTimes(2);
      expect(isSuccessCommandResult(result)).toBe(true);
      if (isSuccessCommandResult(result)) {
        expect(result.data).toStrictEqual(signature);
      }
    });

    it("should use blobLength equal to blob.length in INIT command", async () => {
      // ARRANGE
      const blob = new Uint8Array(120).fill(0x01);
      const metadata = new Uint8Array(30).fill(0x02);
      const signature = new Uint8Array(65).fill(0xee);

      sendCommandMock
        .mockResolvedValueOnce({ status: CommandResultStatus.Success }) // INIT
        .mockResolvedValueOnce(CommandResultFactory({ data: signature })); // LAST

      const task = new SignTransactionTask(
        apiMock,
        { derivationPath: BITTENSOR_PATH, blob, metadata },
        loggerMock,
      );

      // ACT
      await task.run();

      // ASSERT — first call is INIT, inspect args
      const initCommandArg = sendCommandMock.mock.calls[0]?.[0] as
        | { args: { blobLength: number } }
        | undefined;
      expect(initCommandArg).toBeDefined();
      // The INIT command's args.blobLength should equal blob.length
      expect(initCommandArg?.args.blobLength).toBe(blob.length);
    });

    it("should send INIT + ADD + LAST for payloads between 255 and 510 bytes", async () => {
      // ARRANGE
      const blob = new Uint8Array(200).fill(0x03);
      const metadata = new Uint8Array(200).fill(0x04); // total = 400 bytes → 2 data chunks
      const signature = new Uint8Array(65).fill(0xff);

      sendCommandMock
        .mockResolvedValueOnce({ status: CommandResultStatus.Success }) // INIT
        .mockResolvedValueOnce(
          CommandResultFactory({ data: new Uint8Array(0) }),
        ) // ADD
        .mockResolvedValueOnce(CommandResultFactory({ data: signature })); // LAST

      const task = new SignTransactionTask(
        apiMock,
        { derivationPath: BITTENSOR_PATH, blob, metadata },
        loggerMock,
      );

      // ACT
      const result = await task.run();

      // ASSERT
      expect(sendCommandMock).toHaveBeenCalledTimes(3); // INIT + ADD + LAST
      expect(isSuccessCommandResult(result)).toBe(true);
      if (isSuccessCommandResult(result)) {
        expect(result.data).toStrictEqual(signature);
      }
    });

    it("should send INIT + multiple ADD + LAST for large payloads (>510 bytes)", async () => {
      // ARRANGE
      const blob = new Uint8Array(400).fill(0x05);
      const metadata = new Uint8Array(400).fill(0x06); // total = 800 bytes → 4 data chunks
      const signature = new Uint8Array(65).fill(0xaa);

      sendCommandMock
        .mockResolvedValueOnce({ status: CommandResultStatus.Success }) // INIT
        .mockResolvedValueOnce(
          CommandResultFactory({ data: new Uint8Array(0) }),
        ) // ADD 1
        .mockResolvedValueOnce(
          CommandResultFactory({ data: new Uint8Array(0) }),
        ) // ADD 2
        .mockResolvedValueOnce(
          CommandResultFactory({ data: new Uint8Array(0) }),
        ) // ADD 3
        .mockResolvedValueOnce(CommandResultFactory({ data: signature })); // LAST

      const task = new SignTransactionTask(
        apiMock,
        { derivationPath: BITTENSOR_PATH, blob, metadata },
        loggerMock,
      );

      // ACT
      const result = await task.run();

      // ASSERT
      expect(sendCommandMock).toHaveBeenCalledTimes(5); // INIT + 3 ADD + LAST
      expect(isSuccessCommandResult(result)).toBe(true);
      if (isSuccessCommandResult(result)) {
        expect(result.data).toStrictEqual(signature);
      }
    });

    it("should correctly concatenate blob + metadata before chunking", async () => {
      // ARRANGE — use distinctive byte values to verify concatenation
      const blob = new Uint8Array(10).fill(0xaa);
      const metadata = new Uint8Array(10).fill(0xbb);
      const signature = new Uint8Array(65).fill(0xee);

      sendCommandMock
        .mockResolvedValueOnce({ status: CommandResultStatus.Success }) // INIT
        .mockResolvedValueOnce(CommandResultFactory({ data: signature })); // LAST

      const task = new SignTransactionTask(
        apiMock,
        { derivationPath: BITTENSOR_PATH, blob, metadata },
        loggerMock,
      );

      // ACT
      await task.run();

      // ASSERT — the LAST chunk should contain [0xaa * 10, 0xbb * 10]
      const lastCommandArg = sendCommandMock.mock.calls[1]?.[0] as
        | { args: { transactionChunk: Uint8Array } }
        | undefined;
      const chunk = lastCommandArg?.args.transactionChunk;
      expect(chunk).toBeDefined();
      if (chunk) {
        expect(chunk.length).toBe(20);
        expect(Array.from(chunk.slice(0, 10))).toStrictEqual(
          Array(10).fill(0xaa),
        );
        expect(Array.from(chunk.slice(10, 20))).toStrictEqual(
          Array(10).fill(0xbb),
        );
      }
    });

    it("should return InvalidStatusWordError when INIT command fails", async () => {
      // ARRANGE
      sendCommandMock.mockResolvedValueOnce({
        status: CommandResultStatus.Error,
      });

      const task = new SignTransactionTask(
        apiMock,
        {
          derivationPath: BITTENSOR_PATH,
          blob: new Uint8Array(10),
          metadata: new Uint8Array(5),
        },
        loggerMock,
      );

      // ACT
      const result = await task.run();

      // ASSERT
      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        const err = result.error as InvalidStatusWordError;
        expect(err).toBeInstanceOf(InvalidStatusWordError);
        expect(err.originalError?.message).toBe("Failed to sign transaction");
      }
    });

    it("should return error when a data chunk command fails mid-stream", async () => {
      // ARRANGE
      const blob = new Uint8Array(200).fill(0x07);
      const metadata = new Uint8Array(200).fill(0x08); // total 400 bytes
      const commandError = CommandResultFactory({
        error: new PolkadotAppCommandError({
          message: "Data is invalid",
          errorCode: PolkadotErrorCodes.DATA_INVALID,
        }),
      });

      sendCommandMock
        .mockResolvedValueOnce({ status: CommandResultStatus.Success }) // INIT
        .mockResolvedValueOnce(commandError); // ADD fails

      const task = new SignTransactionTask(
        apiMock,
        { derivationPath: BITTENSOR_PATH, blob, metadata },
        loggerMock,
      );

      // ACT
      const result = await task.run();

      // ASSERT
      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        expect(result.error).toBeInstanceOf(PolkadotAppCommandError);
        expect((result.error as PolkadotAppCommandError).errorCode).toBe(
          PolkadotErrorCodes.DATA_INVALID,
        );
      }
    });

    it("should return InvalidStatusWordError when loop exits without producing a signature", async () => {
      // ARRANGE — empty payload (blob=0, metadata=0), loop does not iterate
      sendCommandMock.mockResolvedValueOnce({
        status: CommandResultStatus.Success,
      });

      const task = new SignTransactionTask(
        apiMock,
        {
          derivationPath: BITTENSOR_PATH,
          blob: new Uint8Array(0),
          metadata: new Uint8Array(0),
        },
        loggerMock,
      );

      // ACT
      const result = await task.run();

      // ASSERT
      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        const err = result.error as InvalidStatusWordError;
        expect(err).toBeInstanceOf(InvalidStatusWordError);
        expect(err.originalError?.message).toBe("No signature returned");
      }
    });
  });
});
