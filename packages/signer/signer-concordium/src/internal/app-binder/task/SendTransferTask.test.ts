import {
  APDU_MAX_PAYLOAD,
  CommandResultFactory,
  type InternalApi,
  isSuccessCommandResult,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { vi } from "vitest";

import { type SignTransferCommand } from "@internal/app-binder/command/SignTransferCommand";
import {
  ConcordiumAppCommandError,
  ConcordiumErrorCodes,
} from "@internal/app-binder/command/utils/ConcordiumApplicationErrors";
import { SendTransferTask } from "@internal/app-binder/task/SendTransferTask";

const DERIVATION_PATH = "44'/919'/0'/0'/0'";

// Path encoding: [length=5][5 x 4-byte BE hardened values] = 21 bytes
const PATH_BYTES_LENGTH = 21;

// Extract the raw APDU data bytes from a command (skipping the 5-byte header)
function getApduData(cmd: SignTransferCommand): Uint8Array {
  const apdu = cmd.getApdu();
  const raw = apdu.getRawApdu();
  return raw.slice(5);
}

// Extract P2 byte from command APDU
function getApduP2(cmd: SignTransferCommand): number {
  const raw = cmd.getApdu().getRawApdu();
  return raw[3]!;
}

describe("SendTransferTask", () => {
  let sentCommands: SignTransferCommand[];
  let sendCommandMock: ReturnType<typeof vi.fn>;
  let apiMock: InternalApi;
  let loggerMock: LoggerPublisherService;

  beforeEach(() => {
    sentCommands = [];
    sendCommandMock = vi.fn();
    apiMock = {
      sendCommand: sendCommandMock,
    } as unknown as InternalApi;
    loggerMock = {
      debug: vi.fn(),
    } as unknown as LoggerPublisherService;
  });

  function captureCommands(
    ...results: ReturnType<typeof CommandResultFactory>[]
  ) {
    let callIndex = 0;
    sendCommandMock.mockImplementation((cmd: SignTransferCommand) => {
      sentCommands.push(cmd);
      return Promise.resolve(results[callIndex++]);
    });
  }

  it("should send small transaction in a single chunk with path prepended", async () => {
    const signature = new Uint8Array(64).fill(0xab);
    const transaction = new Uint8Array(50).fill(0x01);

    captureCommands(CommandResultFactory({ data: signature }));

    const task = new SendTransferTask(
      apiMock,
      { derivationPath: DERIVATION_PATH, transaction },
      loggerMock,
    );

    const result = await task.run();

    expect(sentCommands).toHaveLength(1);

    const data = getApduData(sentCommands[0]!);
    expect(data).toHaveLength(PATH_BYTES_LENGTH + transaction.length);

    // P2 = LAST (0x00) for single chunk
    expect(getApduP2(sentCommands[0]!)).toBe(0x00);

    expect(isSuccessCommandResult(result)).toBe(true);
    if (isSuccessCommandResult(result)) {
      expect(result.data).toStrictEqual(signature);
    }
  });

  it("should split large transaction into multiple chunks", async () => {
    const signature = new Uint8Array(64).fill(0xcd);
    const totalPayload = PATH_BYTES_LENGTH + 600;
    const expectedChunks = Math.ceil(totalPayload / APDU_MAX_PAYLOAD);
    const transaction = new Uint8Array(600).fill(0x02);

    const results = Array.from({ length: expectedChunks }, (_, i) =>
      i === expectedChunks - 1
        ? CommandResultFactory({ data: signature })
        : CommandResultFactory({ data: new Uint8Array(0) }),
    );
    captureCommands(...results);

    const task = new SendTransferTask(
      apiMock,
      { derivationPath: DERIVATION_PATH, transaction },
      loggerMock,
    );

    const result = await task.run();

    expect(sentCommands).toHaveLength(expectedChunks);

    // Non-last chunks: P2 = MORE (0x80), full APDU_MAX_PAYLOAD size
    for (let i = 0; i < expectedChunks - 1; i++) {
      expect(getApduP2(sentCommands[i]!)).toBe(0x80);
      expect(getApduData(sentCommands[i]!)).toHaveLength(APDU_MAX_PAYLOAD);
    }

    // Last chunk: P2 = LAST (0x00), remainder size (or full size if exact multiple)
    const lastCmd = sentCommands[expectedChunks - 1]!;
    const expectedLastChunkLength =
      totalPayload % APDU_MAX_PAYLOAD || APDU_MAX_PAYLOAD;
    expect(getApduP2(lastCmd)).toBe(0x00);
    expect(getApduData(lastCmd)).toHaveLength(expectedLastChunkLength);

    expect(isSuccessCommandResult(result)).toBe(true);
    if (isSuccessCommandResult(result)) {
      expect(result.data).toStrictEqual(signature);
    }
  });

  it("should prepend derivation path bytes to the first chunk", async () => {
    const transaction = new Uint8Array(10).fill(0xff);

    captureCommands(CommandResultFactory({ data: new Uint8Array(64) }));

    const task = new SendTransferTask(
      apiMock,
      { derivationPath: DERIVATION_PATH, transaction },
      loggerMock,
    );

    await task.run();

    const data = getApduData(sentCommands[0]!);

    // First byte is path length (5 elements)
    expect(data[0]).toBe(5);

    // Transaction data follows the path bytes
    const txPortion = data.slice(PATH_BYTES_LENGTH);
    expect(txPortion).toStrictEqual(transaction);
  });

  it("should return error when a chunk fails", async () => {
    const transaction = new Uint8Array(50).fill(0x03);

    captureCommands(
      CommandResultFactory({
        error: new ConcordiumAppCommandError({
          message: "User rejected",
          errorCode: ConcordiumErrorCodes.USER_REJECTED,
        }),
      }),
    );

    const task = new SendTransferTask(
      apiMock,
      { derivationPath: DERIVATION_PATH, transaction },
      loggerMock,
    );

    const result = await task.run();

    expect(isSuccessCommandResult(result)).toBe(false);
    if (!isSuccessCommandResult(result)) {
      expect(result.error).toBeInstanceOf(ConcordiumAppCommandError);
    }
  });

  it("should return error on mid-stream chunk failure", async () => {
    const transaction = new Uint8Array(600).fill(0x04);

    captureCommands(
      CommandResultFactory({ data: new Uint8Array(0) }),
      CommandResultFactory({
        error: new ConcordiumAppCommandError({
          message: "Data invalid",
          errorCode: ConcordiumErrorCodes.DATA_INVALID,
        }),
      }),
    );

    const task = new SendTransferTask(
      apiMock,
      { derivationPath: DERIVATION_PATH, transaction },
      loggerMock,
    );

    const result = await task.run();

    expect(sentCommands).toHaveLength(2);
    expect(isSuccessCommandResult(result)).toBe(false);
    if (!isSuccessCommandResult(result)) {
      expect(result.error).toBeInstanceOf(ConcordiumAppCommandError);
      expect((result.error as ConcordiumAppCommandError).errorCode).toBe(
        ConcordiumErrorCodes.DATA_INVALID,
      );
    }
  });

  it("should handle transaction that exactly fills APDU chunks", async () => {
    const signature = new Uint8Array(64).fill(0xee);
    const txSize = 2 * APDU_MAX_PAYLOAD - PATH_BYTES_LENGTH;
    const transaction = new Uint8Array(txSize).fill(0x05);

    captureCommands(
      CommandResultFactory({ data: new Uint8Array(0) }),
      CommandResultFactory({ data: signature }),
    );

    const task = new SendTransferTask(
      apiMock,
      { derivationPath: DERIVATION_PATH, transaction },
      loggerMock,
    );

    const result = await task.run();

    expect(sentCommands).toHaveLength(2);
    expect(getApduData(sentCommands[0]!)).toHaveLength(APDU_MAX_PAYLOAD);
    expect(getApduData(sentCommands[1]!)).toHaveLength(APDU_MAX_PAYLOAD);
    expect(isSuccessCommandResult(result)).toBe(true);
  });

  it("should still send path bytes for empty transaction", async () => {
    const transaction = new Uint8Array(0);

    captureCommands(CommandResultFactory({ data: new Uint8Array(64) }));

    const task = new SendTransferTask(
      apiMock,
      { derivationPath: DERIVATION_PATH, transaction },
      loggerMock,
    );

    await task.run();

    expect(sentCommands).toHaveLength(1);
    expect(getApduData(sentCommands[0]!)).toHaveLength(PATH_BYTES_LENGTH);
  });
});
