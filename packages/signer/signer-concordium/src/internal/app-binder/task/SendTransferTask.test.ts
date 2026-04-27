import {
  APDU_MAX_PAYLOAD,
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { vi } from "vitest";

import { GetAppConfigCommand } from "@internal/app-binder/command/GetAppConfigCommand";
import { type SignTransferCommand } from "@internal/app-binder/command/SignTransferCommand";
import {
  ConcordiumAppCommandError,
  ConcordiumErrorCodes,
} from "@internal/app-binder/command/utils/ConcordiumApplicationErrors";
import { P2 } from "@internal/app-binder/constants";
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

  describe("fee display", () => {
    /**
     * When a fee is provided, the task probes the app version via
     * GetAppConfigCommand before sending chunks. We intercept that probe
     * separately from the SignTransfer chunks so the assertions on
     * `sentCommands` stay focused on the signing APDUs.
     */
    function mockVersionAndSignFlow(
      version: string | null,
      ...signResults: ReturnType<typeof CommandResultFactory>[]
    ) {
      let signIndex = 0;
      sendCommandMock.mockImplementation((cmd: unknown) => {
        if (cmd instanceof GetAppConfigCommand) {
          if (version === null) {
            return Promise.resolve(
              CommandResultFactory({
                error: new InvalidStatusWordError("probe failed"),
              }),
            );
          }
          return Promise.resolve(CommandResultFactory({ data: { version } }));
        }
        sentCommands.push(cmd as SignTransferCommand);
        return Promise.resolve(signResults[signIndex++]);
      });
    }

    it("attaches fee bytes and P2=FEE_DISPLAY to last chunk when version is supported", async () => {
      const signature = new Uint8Array(64).fill(0xab);
      const transaction = new Uint8Array(50).fill(0x01);
      const fee = 0x0123456789abcdefn;

      mockVersionAndSignFlow(
        "5.5.2",
        CommandResultFactory({ data: signature }),
      );

      const task = new SendTransferTask(
        apiMock,
        {
          derivationPath: DERIVATION_PATH,
          transaction,
          displayFeeMicroCcd: fee,
        },
        loggerMock,
      );

      const result = await task.run();

      expect(sentCommands).toHaveLength(1);
      const raw = sentCommands[0]!.getApdu().getRawApdu();
      expect(raw[3]).toBe(P2.FEE_DISPLAY);

      const data = getApduData(sentCommands[0]!);
      // Data ends with the 8-byte fee in big-endian order
      expect(data.slice(-8)).toStrictEqual(
        new Uint8Array([0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef]),
      );
      // Preceding bytes are exactly path + transaction (no fee inside them)
      expect(data.slice(0, -8)).toHaveLength(
        PATH_BYTES_LENGTH + transaction.length,
      );

      expect(isSuccessCommandResult(result)).toBe(true);
    });

    it("falls back to legacy P2=LAST when firmware is below 5.5.2", async () => {
      const signature = new Uint8Array(64).fill(0xab);
      const transaction = new Uint8Array(50).fill(0x01);

      mockVersionAndSignFlow(
        "5.5.1",
        CommandResultFactory({ data: signature }),
      );

      const task = new SendTransferTask(
        apiMock,
        {
          derivationPath: DERIVATION_PATH,
          transaction,
          displayFeeMicroCcd: 12345n,
        },
        loggerMock,
      );

      await task.run();

      expect(sentCommands).toHaveLength(1);
      const raw = sentCommands[0]!.getApdu().getRawApdu();
      expect(raw[3]).toBe(P2.LAST);
      // No fee bytes appended; payload is exactly path + transaction
      expect(getApduData(sentCommands[0]!)).toHaveLength(
        PATH_BYTES_LENGTH + transaction.length,
      );
    });

    it("falls back to legacy P2=LAST when version probe fails", async () => {
      const signature = new Uint8Array(64).fill(0xab);
      const transaction = new Uint8Array(50).fill(0x01);

      mockVersionAndSignFlow(null, CommandResultFactory({ data: signature }));

      const task = new SendTransferTask(
        apiMock,
        {
          derivationPath: DERIVATION_PATH,
          transaction,
          displayFeeMicroCcd: 12345n,
        },
        loggerMock,
      );

      await task.run();

      expect(sentCommands).toHaveLength(1);
      const raw = sentCommands[0]!.getApdu().getRawApdu();
      expect(raw[3]).toBe(P2.LAST);
      expect(getApduData(sentCommands[0]!)).toHaveLength(
        PATH_BYTES_LENGTH + transaction.length,
      );
    });

    it("skips the version probe when no fee is provided (no extra APDU)", async () => {
      const signature = new Uint8Array(64).fill(0xab);
      const transaction = new Uint8Array(50).fill(0x01);
      const allCommands: unknown[] = [];

      sendCommandMock.mockImplementation((cmd: unknown) => {
        allCommands.push(cmd);
        return Promise.resolve(CommandResultFactory({ data: signature }));
      });

      const task = new SendTransferTask(
        apiMock,
        { derivationPath: DERIVATION_PATH, transaction },
        loggerMock,
      );

      await task.run();

      // Exactly one command total — no GetAppConfig probe
      expect(allCommands).toHaveLength(1);
      expect(allCommands[0]).not.toBeInstanceOf(GetAppConfigCommand);
    });

    it("attaches fee only to the last chunk when the transaction spans multiple chunks", async () => {
      const signature = new Uint8Array(64).fill(0xcd);
      const totalPayload = PATH_BYTES_LENGTH + 600;
      const expectedChunks = Math.ceil(totalPayload / APDU_MAX_PAYLOAD);
      const transaction = new Uint8Array(600).fill(0x02);
      const fee = 0xdeadbeefn;

      const signResults = Array.from({ length: expectedChunks }, (_, i) =>
        i === expectedChunks - 1
          ? CommandResultFactory({ data: signature })
          : CommandResultFactory({ data: new Uint8Array(0) }),
      );
      mockVersionAndSignFlow("5.5.2", ...signResults);

      const task = new SendTransferTask(
        apiMock,
        {
          derivationPath: DERIVATION_PATH,
          transaction,
          displayFeeMicroCcd: fee,
        },
        loggerMock,
      );

      await task.run();

      expect(sentCommands).toHaveLength(expectedChunks);

      // All non-last chunks: P2=MORE, no fee suffix
      for (let i = 0; i < expectedChunks - 1; i++) {
        const raw = sentCommands[i]!.getApdu().getRawApdu();
        expect(raw[3]).toBe(P2.MORE);
        expect(getApduData(sentCommands[i]!)).toHaveLength(APDU_MAX_PAYLOAD);
      }

      // Last chunk: P2=FEE_DISPLAY, fee bytes at the end
      const last = sentCommands[expectedChunks - 1]!;
      expect(last.getApdu().getRawApdu()[3]).toBe(P2.FEE_DISPLAY);
      expect(getApduData(last).slice(-8)).toStrictEqual(
        new Uint8Array([0, 0, 0, 0, 0xde, 0xad, 0xbe, 0xef]),
      );
    });
  });
});
