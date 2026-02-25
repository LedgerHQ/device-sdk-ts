import {
  CommandResultFactory,
  CommandResultStatus,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { vi } from "vitest";

import {
  CosmosAppCommandError,
  CosmosErrorCodes,
} from "@internal/app-binder/command/utils/CosmosApplicationErrors";
import { SignTransactionTask } from "@internal/app-binder/task/SignTransactionTask";

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
    it("should run the task and return signature on success", async () => {
      // ARRANGE
      const signature = new Uint8Array(64).fill(0xcd);
      const transaction = new Uint8Array(300).fill(0x02);
      sendCommandMock
        .mockResolvedValueOnce({ status: CommandResultStatus.Success }) // INIT
        .mockResolvedValueOnce(
          CommandResultFactory({ data: new Uint8Array(0) }),
        ) // ADD
        .mockResolvedValueOnce(CommandResultFactory({ data: signature })); // LAST

      const task = new SignTransactionTask(
        apiMock,
        {
          derivationPath: "44'/118'/0'/0/0",
          hrp: "cosmos",
          transaction,
        },
        loggerMock,
      );

      // ACT
      const result = await task.run();

      // ASSERT
      expect(isSuccessCommandResult(result)).toBe(true);
      if (isSuccessCommandResult(result)) {
        expect(result.data).toStrictEqual(signature);
      }
    });

    it("should return error when apdu response contains error", async () => {
      // ARRANGE
      const transaction = new Uint8Array(50);
      const commandError = CommandResultFactory({
        error: new CosmosAppCommandError({
          message: "Data Invalid",
          errorCode: CosmosErrorCodes.DATA_INVALID,
        }),
      });

      sendCommandMock
        .mockResolvedValueOnce({ status: CommandResultStatus.Success }) // INIT
        .mockResolvedValueOnce(commandError); // LAST

      const task = new SignTransactionTask(
        apiMock,
        {
          derivationPath: "44'/118'/0'/0/0",
          hrp: "cosmos",
          transaction,
        },
        loggerMock,
      );

      // ACT
      const result = await task.run();

      // ASSERT
      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        expect(result.error).toBeInstanceOf(CosmosAppCommandError);
        expect((result.error as CosmosAppCommandError).errorCode).toBe(
          CosmosErrorCodes.DATA_INVALID,
        );
      }
    });

    it("should return InvalidStatusWordError when wrong derivation path or hrp is provided", async () => {
      // ARRANGE
      sendCommandMock.mockResolvedValue({
        status: CommandResultStatus.Error,
      });
      const task = new SignTransactionTask(
        apiMock,
        {
          derivationPath: "44'/118'/0'/0",
          hrp: "cosmos",
          transaction: new Uint8Array(0),
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

    it("should return InvalidStatusWordError when apdu response does not contain signature", async () => {
      // ARRANGE
      sendCommandMock.mockResolvedValue({
        status: CommandResultStatus.Success,
      });
      const task = new SignTransactionTask(
        apiMock,
        {
          derivationPath: "44'/118'/0'/0/0",
          hrp: "cosmos",
          transaction: new Uint8Array(0),
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
