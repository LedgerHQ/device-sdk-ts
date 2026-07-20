import {
  APDU_MAX_PAYLOAD,
  CommandResultFactory,
  CommandResultStatus,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { Just, Nothing } from "purify-ts";
import { vi } from "vitest";

import {
  P1_ADD,
  P1_INIT,
  P1_LAST,
  P2_NO_STAKE,
  type SignTransactionCommand,
} from "@internal/app-binder/command/SignTransactionCommand";
import {
  IcpAppCommandError,
  IcpErrorCodes,
} from "@internal/app-binder/command/utils/IcpApplicationErrors";
import { SignTransactionTask } from "@internal/app-binder/task/SignTransactionTask";

const DERIVATION_PATH = "44'/223'/0'/0/0";
const PATH_PAYLOAD_LENGTH = 20;
const APDU_HEADER_LENGTH = 5; // cla, ins, p1, p2, lc
const signature = { r: "aa", s: "bb", v: 1, der: "3006" };

// Reads the [cla, ins, p1, p2] header + payload of the command handed to sendCommand.
const inspect = (command: SignTransactionCommand) => {
  const raw = command.getApdu().getRawApdu();
  return {
    cla: raw[0],
    ins: raw[1],
    p1: raw[2],
    p2: raw[3],
    payload: raw.slice(APDU_HEADER_LENGTH),
  };
};

describe("SignTransactionTask", () => {
  let sendCommandMock: ReturnType<typeof vi.fn>;
  let apiMock: InternalApi;
  let loggerMock: LoggerPublisherService;

  beforeEach(() => {
    sendCommandMock = vi.fn();
    apiMock = { sendCommand: sendCommandMock } as unknown as InternalApi;
    loggerMock = { debug: vi.fn() } as unknown as LoggerPublisherService;
  });

  describe("run", () => {
    it("should send INIT(path) then ADD/LAST chunks, all with P2=no-stake, and return the signature", async () => {
      // ARRANGE
      // 300 bytes → one full 255-byte ADD chunk + one 45-byte LAST chunk.
      const transaction = new Uint8Array(300).map((_, i) => i & 0xff);
      sendCommandMock
        .mockResolvedValueOnce({ status: CommandResultStatus.Success }) // INIT
        .mockResolvedValueOnce(CommandResultFactory({ data: Nothing })) // ADD
        .mockResolvedValueOnce(CommandResultFactory({ data: Just(signature) })); // LAST

      const task = new SignTransactionTask(
        apiMock,
        { derivationPath: DERIVATION_PATH, transaction },
        loggerMock,
      );

      // ACT
      const result = await task.run();

      // ASSERT
      expect(isSuccessCommandResult(result)).toBe(true);
      if (isSuccessCommandResult(result)) {
        expect(result.data).toStrictEqual(signature);
      }

      expect(sendCommandMock).toHaveBeenCalledTimes(3);
      const [init, add, last] = sendCommandMock.mock.calls.map((c) =>
        inspect(c[0] as SignTransactionCommand),
      );

      // every packet targets the ICP sign instruction with the stake flag pinned off
      for (const packet of [init, add, last]) {
        expect(packet!.cla).toBe(0x11);
        expect(packet!.ins).toBe(0x02);
        expect(packet!.p2).toBe(P2_NO_STAKE);
      }

      // phase sequence is INIT → ADD → LAST
      expect(init!.p1).toBe(P1_INIT);
      expect(add!.p1).toBe(P1_ADD);
      expect(last!.p1).toBe(P1_LAST);

      // INIT carries only the 20-byte path; chunks split the tx at APDU_MAX_PAYLOAD
      expect(init!.payload.length).toBe(PATH_PAYLOAD_LENGTH);
      expect(add!.payload.length).toBe(APDU_MAX_PAYLOAD);
      expect(last!.payload.length).toBe(transaction.length - APDU_MAX_PAYLOAD);
      expect(new Uint8Array([...add!.payload, ...last!.payload])).toStrictEqual(
        transaction,
      );
    });

    it("should send the whole transaction in a single LAST chunk when it fits one packet", async () => {
      // ARRANGE
      const transaction = new Uint8Array(50).fill(0x07);
      sendCommandMock
        .mockResolvedValueOnce({ status: CommandResultStatus.Success }) // INIT
        .mockResolvedValueOnce(CommandResultFactory({ data: Just(signature) })); // LAST

      const task = new SignTransactionTask(
        apiMock,
        { derivationPath: DERIVATION_PATH, transaction },
        loggerMock,
      );

      // ACT
      const result = await task.run();

      // ASSERT
      expect(sendCommandMock).toHaveBeenCalledTimes(2);
      const [, last] = sendCommandMock.mock.calls.map((c) =>
        inspect(c[0] as SignTransactionCommand),
      );
      expect(last!.p1).toBe(P1_LAST);
      expect(last!.payload).toStrictEqual(transaction);
      expect(isSuccessCommandResult(result)).toBe(true);
    });

    it("should refuse an empty transaction without touching the device", async () => {
      // ARRANGE
      const task = new SignTransactionTask(
        apiMock,
        { derivationPath: DERIVATION_PATH, transaction: new Uint8Array(0) },
        loggerMock,
      );

      // ACT
      const result = await task.run();

      // ASSERT
      expect(sendCommandMock).not.toHaveBeenCalled();
      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        const err = result.error as InvalidStatusWordError;
        expect(err).toBeInstanceOf(InvalidStatusWordError);
        expect(err.originalError?.message).toBe("Transaction is empty");
      }
    });

    it("should return the init error when the INIT command fails", async () => {
      // ARRANGE
      const commandError = CommandResultFactory({
        error: new IcpAppCommandError({
          message: "Conditions not satisfied",
          errorCode: IcpErrorCodes.CONDITIONS_NOT_SATISFIED,
        }),
      });
      sendCommandMock.mockResolvedValueOnce(commandError);

      const task = new SignTransactionTask(
        apiMock,
        { derivationPath: DERIVATION_PATH, transaction: new Uint8Array(10) },
        loggerMock,
      );

      // ACT
      const result = await task.run();

      // ASSERT
      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        expect(result.error).toBeInstanceOf(IcpAppCommandError);
      }
      // INIT is attempted, no chunk is sent after the failure
      expect(sendCommandMock).toHaveBeenCalledTimes(1);
    });

    it("should return the chunk error when a chunk command fails", async () => {
      // ARRANGE
      const commandError = CommandResultFactory({
        error: new IcpAppCommandError({
          message: "Data Invalid",
          errorCode: IcpErrorCodes.DATA_INVALID,
        }),
      });
      sendCommandMock
        .mockResolvedValueOnce({ status: CommandResultStatus.Success }) // INIT
        .mockResolvedValueOnce(commandError); // LAST

      const task = new SignTransactionTask(
        apiMock,
        { derivationPath: DERIVATION_PATH, transaction: new Uint8Array(50) },
        loggerMock,
      );

      // ACT
      const result = await task.run();

      // ASSERT
      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        expect((result.error as IcpAppCommandError).errorCode).toBe(
          IcpErrorCodes.DATA_INVALID,
        );
      }
    });

    it("should error when the last chunk succeeds but returns no signature", async () => {
      // ARRANGE — every chunk replies success but never a signature
      sendCommandMock
        .mockResolvedValueOnce({ status: CommandResultStatus.Success }) // INIT
        .mockResolvedValueOnce(CommandResultFactory({ data: Nothing })); // LAST

      const task = new SignTransactionTask(
        apiMock,
        { derivationPath: DERIVATION_PATH, transaction: new Uint8Array(50) },
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
