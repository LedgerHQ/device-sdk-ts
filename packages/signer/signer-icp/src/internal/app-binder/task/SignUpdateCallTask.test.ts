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

import { type DeviceUpdateCallSignature } from "@api/model/UpdateCallSignature";
import { type SignUpdateCallCommand } from "@internal/app-binder/command/SignUpdateCallCommand";
import {
  IcpAppCommandError,
  IcpErrorCodes,
} from "@internal/app-binder/command/utils/IcpApplicationErrors";
import { P1_ADD, P1_INIT, P1_LAST } from "@internal/app-binder/constants";
import { SignUpdateCallTask } from "@internal/app-binder/task/SignUpdateCallTask";

const DERIVATION_PATH = "44'/223'/0'/0/0";
const PATH_PAYLOAD_LENGTH = 20;
const APDU_HEADER_LENGTH = 5; // cla, ins, p1, p2, lc

const deviceSignature: DeviceUpdateCallSignature = {
  requestHash: "11".repeat(32),
  requestSignature: { r: "aa".repeat(32), s: "bb".repeat(32) },
  readStateHash: "22".repeat(32),
  readStateSignature: { r: "cc".repeat(32), s: "dd".repeat(32) },
};

const inspect = (command: SignUpdateCallCommand) => {
  const raw = command.getApdu().getRawApdu();
  return {
    cla: raw[0],
    ins: raw[1],
    p1: raw[2],
    p2: raw[3],
    payload: raw.slice(APDU_HEADER_LENGTH),
  };
};

describe("SignUpdateCallTask", () => {
  let sendCommandMock: ReturnType<typeof vi.fn>;
  let apiMock: InternalApi;
  let loggerMock: LoggerPublisherService;

  beforeEach(() => {
    sendCommandMock = vi.fn();
    apiMock = { sendCommand: sendCommandMock } as unknown as InternalApi;
    loggerMock = { debug: vi.fn() } as unknown as LoggerPublisherService;
  });

  describe("run", () => {
    it("should frame the message as [u32LE readStateLen][readState][u32LE callLen][call] with the read-state first", async () => {
      // ARRANGE — distinct small bodies fit a single LAST chunk
      const callRequest = new Uint8Array([0x01, 0x02, 0x03]);
      const readStateRequest = new Uint8Array([0x09, 0x08]);
      sendCommandMock
        .mockResolvedValueOnce({ status: CommandResultStatus.Success }) // INIT
        .mockResolvedValueOnce(
          CommandResultFactory({ data: Just(deviceSignature) }),
        ); // LAST

      const task = new SignUpdateCallTask(
        apiMock,
        { derivationPath: DERIVATION_PATH, callRequest, readStateRequest },
        loggerMock,
      );

      // ACT
      await task.run();

      // ASSERT — INS 0x03, phase INIT then LAST
      const [init, last] = sendCommandMock.mock.calls.map((c) =>
        inspect(c[0] as SignUpdateCallCommand),
      );
      expect(init!.ins).toBe(0x03);
      expect(init!.p1).toBe(P1_INIT);
      expect(init!.payload.length).toBe(PATH_PAYLOAD_LENGTH);
      expect(last!.p1).toBe(P1_LAST);

      // read-state length (2, LE) · read-state · call length (3, LE) · call
      const expected = new Uint8Array([
        0x02, 0x00, 0x00, 0x00, 0x09, 0x08, 0x03, 0x00, 0x00, 0x00, 0x01, 0x02,
        0x03,
      ]);
      expect(last!.payload).toStrictEqual(expected);
    });

    it("should return both signatures and echo the read-state body on success", async () => {
      // ARRANGE
      const callRequest = new Uint8Array([0xca, 0x11]);
      const readStateRequest = new Uint8Array([0x5e, 0xed]);
      sendCommandMock
        .mockResolvedValueOnce({ status: CommandResultStatus.Success }) // INIT
        .mockResolvedValueOnce(
          CommandResultFactory({ data: Just(deviceSignature) }),
        ); // LAST

      const task = new SignUpdateCallTask(
        apiMock,
        { derivationPath: DERIVATION_PATH, callRequest, readStateRequest },
        loggerMock,
      );

      // ACT
      const result = await task.run();

      // ASSERT — both request ids surface, read-state body kept alongside
      expect(isSuccessCommandResult(result)).toBe(true);
      if (isSuccessCommandResult(result)) {
        expect(result.data).toStrictEqual({
          ...deviceSignature,
          readStateBody: readStateRequest,
        });
      }
    });

    it("should split a large combined message across ADD/LAST chunks", async () => {
      // ARRANGE — 8-byte prefix + 300 + 300 = 608 bytes → ADD (255) + ADD (255) + LAST (98)
      const callRequest = new Uint8Array(300).fill(0x01);
      const readStateRequest = new Uint8Array(300).fill(0x02);
      sendCommandMock
        .mockResolvedValueOnce({ status: CommandResultStatus.Success }) // INIT
        .mockResolvedValueOnce(CommandResultFactory({ data: Nothing })) // ADD
        .mockResolvedValueOnce(CommandResultFactory({ data: Nothing })) // ADD
        .mockResolvedValueOnce(
          CommandResultFactory({ data: Just(deviceSignature) }),
        ); // LAST

      const task = new SignUpdateCallTask(
        apiMock,
        { derivationPath: DERIVATION_PATH, callRequest, readStateRequest },
        loggerMock,
      );

      // ACT
      await task.run();

      // ASSERT — chunk phases and reassembled body match the framed message
      const [, ...chunks] = sendCommandMock.mock.calls.map((c) =>
        inspect(c[0] as SignUpdateCallCommand),
      );
      expect(chunks.map((c) => c!.p1)).toStrictEqual([P1_ADD, P1_ADD, P1_LAST]);
      expect(chunks[0]!.payload.length).toBe(APDU_MAX_PAYLOAD);

      const reassembled = new Uint8Array([
        ...chunks[0]!.payload,
        ...chunks[1]!.payload,
        ...chunks[2]!.payload,
      ]);
      const expected = new Uint8Array(8 + 600);
      new DataView(expected.buffer).setUint32(0, 300, true);
      expected.set(readStateRequest, 4);
      new DataView(expected.buffer).setUint32(304, 300, true);
      expected.set(callRequest, 308);
      expect(reassembled).toStrictEqual(expected);
    });

    it("should refuse a missing call request without touching the device", async () => {
      // ARRANGE
      const task = new SignUpdateCallTask(
        apiMock,
        {
          derivationPath: DERIVATION_PATH,
          callRequest: new Uint8Array(0),
          readStateRequest: new Uint8Array([0x01]),
        },
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
        expect(err.originalError?.message).toBe(
          "Both call and read-state requests are required",
        );
      }
    });

    it("should refuse a missing read-state request without touching the device", async () => {
      // ARRANGE
      const task = new SignUpdateCallTask(
        apiMock,
        {
          derivationPath: DERIVATION_PATH,
          callRequest: new Uint8Array([0x01]),
          readStateRequest: new Uint8Array(0),
        },
        loggerMock,
      );

      // ACT
      const result = await task.run();

      // ASSERT
      expect(sendCommandMock).not.toHaveBeenCalled();
      expect(isSuccessCommandResult(result)).toBe(false);
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

      const task = new SignUpdateCallTask(
        apiMock,
        {
          derivationPath: DERIVATION_PATH,
          callRequest: new Uint8Array([0x01]),
          readStateRequest: new Uint8Array([0x02]),
        },
        loggerMock,
      );

      // ACT
      const result = await task.run();

      // ASSERT — INIT attempted, no chunk sent afterwards
      expect(isSuccessCommandResult(result)).toBe(false);
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

      const task = new SignUpdateCallTask(
        apiMock,
        {
          derivationPath: DERIVATION_PATH,
          callRequest: new Uint8Array([0x01]),
          readStateRequest: new Uint8Array([0x02]),
        },
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
      // ARRANGE
      sendCommandMock
        .mockResolvedValueOnce({ status: CommandResultStatus.Success }) // INIT
        .mockResolvedValueOnce(CommandResultFactory({ data: Nothing })); // LAST

      const task = new SignUpdateCallTask(
        apiMock,
        {
          derivationPath: DERIVATION_PATH,
          callRequest: new Uint8Array([0x01]),
          readStateRequest: new Uint8Array([0x02]),
        },
        loggerMock,
      );

      // ACT
      const result = await task.run();

      // ASSERT
      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        const err = result.error as InvalidStatusWordError;
        expect(err.originalError?.message).toBe("No signature returned");
      }
    });
  });
});
