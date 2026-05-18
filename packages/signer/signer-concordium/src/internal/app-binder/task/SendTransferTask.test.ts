import {
  APDU_MAX_PAYLOAD,
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { vi } from "vitest";

import { type SignTransferCommand } from "@internal/app-binder/command/SignTransferCommand";
import {
  ConcordiumAppCommandError,
  ConcordiumErrorCodes,
} from "@internal/app-binder/command/utils/ConcordiumApplicationErrors";
import { FEE_DISPLAY_SIZE } from "@internal/app-binder/constants";
import { SendTransferTask } from "@internal/app-binder/task/SendTransferTask";

const DERIVATION_PATH = "44'/919'/0'/0'/0'";

// Path encoding: [length=5][5 x 4-byte BE hardened values] = 21 bytes
const PATH_BYTES_LENGTH = 21;

function getApduData(cmd: SignTransferCommand): Uint8Array {
  const apdu = cmd.getApdu();
  const raw = apdu.getRawApdu();
  return raw.slice(5);
}

function getApduP2(cmd: SignTransferCommand): number {
  const raw = cmd.getApdu().getRawApdu();
  return raw[3]!;
}

const NO_FEE = {
  maxFee: 0n,
  supportsFeeDisplay: false,
};

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

  it("should send the transaction in a single APDU with path prepended", async () => {
    const signature = new Uint8Array(64).fill(0xab);
    const transaction = new Uint8Array(50).fill(0x01);

    captureCommands(CommandResultFactory({ data: signature }));

    const task = new SendTransferTask(
      apiMock,
      { derivationPath: DERIVATION_PATH, transaction, ...NO_FEE },
      loggerMock,
    );

    const result = await task.run();

    expect(sentCommands).toHaveLength(1);

    const data = getApduData(sentCommands[0]!);
    expect(data).toHaveLength(PATH_BYTES_LENGTH + transaction.length);

    // P2 = LAST (0x00) when fee display is not supported
    expect(getApduP2(sentCommands[0]!)).toBe(0x00);

    expect(isSuccessCommandResult(result)).toBe(true);
    if (isSuccessCommandResult(result)) {
      expect(result.data).toStrictEqual(signature);
    }
  });

  it("should prepend derivation path bytes to the payload", async () => {
    const transaction = new Uint8Array(10).fill(0xff);

    captureCommands(CommandResultFactory({ data: new Uint8Array(64) }));

    const task = new SendTransferTask(
      apiMock,
      { derivationPath: DERIVATION_PATH, transaction, ...NO_FEE },
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

  it("should return error when send fails", async () => {
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
      { derivationPath: DERIVATION_PATH, transaction, ...NO_FEE },
      loggerMock,
    );

    const result = await task.run();

    expect(isSuccessCommandResult(result)).toBe(false);
    if (!isSuccessCommandResult(result)) {
      expect(result.error).toBeInstanceOf(ConcordiumAppCommandError);
    }
  });

  it("should still send path bytes for empty transaction", async () => {
    const transaction = new Uint8Array(0);

    captureCommands(CommandResultFactory({ data: new Uint8Array(64) }));

    const task = new SendTransferTask(
      apiMock,
      { derivationPath: DERIVATION_PATH, transaction, ...NO_FEE },
      loggerMock,
    );

    await task.run();

    expect(sentCommands).toHaveLength(1);
    expect(getApduData(sentCommands[0]!)).toHaveLength(PATH_BYTES_LENGTH);
  });

  describe("APDU size guard", () => {
    it("returns an error when path + transaction exceeds APDU_MAX_PAYLOAD", async () => {
      const oversizedTransaction = new Uint8Array(
        APDU_MAX_PAYLOAD - PATH_BYTES_LENGTH + 1,
      ).fill(0x05);

      const task = new SendTransferTask(
        apiMock,
        {
          derivationPath: DERIVATION_PATH,
          transaction: oversizedTransaction,
          ...NO_FEE,
        },
        loggerMock,
      );

      const result = await task.run();

      expect(sentCommands).toHaveLength(0);
      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        expect(result.error).toBeInstanceOf(InvalidStatusWordError);
        expect(
          (result.error as InvalidStatusWordError).originalError?.message,
        ).toContain("exceeds APDU limit");
      }
    });

    it("returns an error when fee suffix pushes payload past APDU_MAX_PAYLOAD", async () => {
      // Payload without fee fits exactly; with fee it overflows by FEE_DISPLAY_SIZE.
      const transaction = new Uint8Array(
        APDU_MAX_PAYLOAD - PATH_BYTES_LENGTH,
      ).fill(0x06);

      const task = new SendTransferTask(
        apiMock,
        {
          derivationPath: DERIVATION_PATH,
          transaction,
          maxFee: 1n,
          supportsFeeDisplay: true,
        },
        loggerMock,
      );

      const result = await task.run();

      expect(sentCommands).toHaveLength(0);
      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        expect(result.error).toBeInstanceOf(InvalidStatusWordError);
      }
    });

    it("accepts a payload that fits exactly at APDU_MAX_PAYLOAD", async () => {
      const signature = new Uint8Array(64).fill(0xee);
      const transaction = new Uint8Array(
        APDU_MAX_PAYLOAD - PATH_BYTES_LENGTH,
      ).fill(0x07);

      captureCommands(CommandResultFactory({ data: signature }));

      const task = new SendTransferTask(
        apiMock,
        { derivationPath: DERIVATION_PATH, transaction, ...NO_FEE },
        loggerMock,
      );

      const result = await task.run();

      expect(sentCommands).toHaveLength(1);
      expect(getApduData(sentCommands[0]!)).toHaveLength(APDU_MAX_PAYLOAD);
      expect(isSuccessCommandResult(result)).toBe(true);
    });
  });

  describe("fee display (P2=0x01)", () => {
    it("appends 8-byte BE max-fee and sets P2=0x01 when supported", async () => {
      const signature = new Uint8Array(64).fill(0xab);
      const transaction = new Uint8Array(50).fill(0x01);
      const maxFee = 0x0102030405060708n;

      captureCommands(CommandResultFactory({ data: signature }));

      const task = new SendTransferTask(
        apiMock,
        {
          derivationPath: DERIVATION_PATH,
          transaction,
          maxFee,
          supportsFeeDisplay: true,
        },
        loggerMock,
      );

      const result = await task.run();

      expect(sentCommands).toHaveLength(1);

      const data = getApduData(sentCommands[0]!);
      expect(data).toHaveLength(
        PATH_BYTES_LENGTH + transaction.length + FEE_DISPLAY_SIZE,
      );

      const tail = data.slice(data.length - FEE_DISPLAY_SIZE);
      expect(Array.from(tail)).toEqual([
        0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
      ]);

      expect(getApduP2(sentCommands[0]!)).toBe(0x01);
      expect(isSuccessCommandResult(result)).toBe(true);
    });

    it("sends legacy bytes and P2=0x00 when not supported even if maxFee provided", async () => {
      const signature = new Uint8Array(64).fill(0xab);
      const transaction = new Uint8Array(50).fill(0x01);

      captureCommands(CommandResultFactory({ data: signature }));

      const task = new SendTransferTask(
        apiMock,
        {
          derivationPath: DERIVATION_PATH,
          transaction,
          maxFee: 12345n,
          supportsFeeDisplay: false,
        },
        loggerMock,
      );

      await task.run();

      const data = getApduData(sentCommands[0]!);
      expect(data).toHaveLength(PATH_BYTES_LENGTH + transaction.length);
      expect(getApduP2(sentCommands[0]!)).toBe(0x00);
    });
  });
});
