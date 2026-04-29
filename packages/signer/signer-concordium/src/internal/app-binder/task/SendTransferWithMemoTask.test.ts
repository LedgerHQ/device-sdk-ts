import {
  APDU_MAX_PAYLOAD,
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { vi } from "vitest";

import { type SignTransferWithMemoCommand } from "@internal/app-binder/command/SignTransferWithMemoCommand";
import {
  ConcordiumAppCommandError,
  ConcordiumErrorCodes,
} from "@internal/app-binder/command/utils/ConcordiumApplicationErrors";
import { P1 } from "@internal/app-binder/constants";
import { SendTransferWithMemoTask } from "@internal/app-binder/task/SendTransferWithMemoTask";

const DERIVATION_PATH = "44'/919'/0'/0'/0'";

// Path encoding: [length=5][5 x 4-byte BE hardened values] = 21 bytes
const PATH_BYTES_LENGTH = 21;

// Header: sender(32) + nonce(8) + energy(8) + payloadSize(4) + expiry(8) + type(1) = 61
const HEADER_LENGTH = 61;
const RECIPIENT_LENGTH = 32;
const MEMO_LENGTH_FIELD = 2;
const AMOUNT_LENGTH = 8;

/**
 * Build a fake serialized TransferWithMemo transaction.
 * Layout: [header:61][recipient:32][memoLength:2][memo:N][amount:8]
 */
function buildTransaction(memoSize: number): Uint8Array {
  const totalLength =
    HEADER_LENGTH +
    RECIPIENT_LENGTH +
    MEMO_LENGTH_FIELD +
    memoSize +
    AMOUNT_LENGTH;
  const tx = new Uint8Array(totalLength);

  // Fill header with 0x11
  tx.fill(0x11, 0, HEADER_LENGTH);
  // Set type byte at offset 60 to TransferWithMemo (22 = 0x16)
  tx[60] = 0x16;

  // Fill recipient with 0x22
  tx.fill(0x22, HEADER_LENGTH, HEADER_LENGTH + RECIPIENT_LENGTH);

  // Memo length (big-endian)
  const memoLenOffset = HEADER_LENGTH + RECIPIENT_LENGTH;
  tx[memoLenOffset] = (memoSize >> 8) & 0xff;
  tx[memoLenOffset + 1] = memoSize & 0xff;

  // Fill memo with 0x33
  const memoStart = memoLenOffset + MEMO_LENGTH_FIELD;
  tx.fill(0x33, memoStart, memoStart + memoSize);

  // Fill amount with 0x44
  tx.fill(0x44, memoStart + memoSize, memoStart + memoSize + AMOUNT_LENGTH);

  return tx;
}

function getApduData(cmd: SignTransferWithMemoCommand): Uint8Array {
  return cmd.getApdu().getRawApdu().slice(5);
}

function getApduP1(cmd: SignTransferWithMemoCommand): number {
  return cmd.getApdu().getRawApdu()[2]!;
}

describe("SendTransferWithMemoTask", () => {
  let sentCommands: SignTransferWithMemoCommand[];
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
    sendCommandMock.mockImplementation((cmd: SignTransferWithMemoCommand) => {
      sentCommands.push(cmd);
      return Promise.resolve(results[callIndex++]);
    });
  }

  it("should send 3-step sequence for short memo", async () => {
    const memoSize = 10;
    const transaction = buildTransaction(memoSize);
    const signature = new Uint8Array(64).fill(0xab);

    // header OK, memo OK, amount returns signature
    captureCommands(
      CommandResultFactory({ data: new Uint8Array(0) }),
      CommandResultFactory({ data: new Uint8Array(0) }),
      CommandResultFactory({ data: signature }),
    );

    const task = new SendTransferWithMemoTask(
      apiMock,
      { derivationPath: DERIVATION_PATH, transaction },
      loggerMock,
    );

    const result = await task.run();

    expect(sentCommands).toHaveLength(3);

    // Step 1: header
    expect(getApduP1(sentCommands[0]!)).toBe(P1.INITIAL_WITH_MEMO);
    const headerData = getApduData(sentCommands[0]!);
    expect(headerData).toHaveLength(
      PATH_BYTES_LENGTH + HEADER_LENGTH + RECIPIENT_LENGTH + MEMO_LENGTH_FIELD,
    );

    // Step 2: memo
    expect(getApduP1(sentCommands[1]!)).toBe(P1.MEMO);
    expect(getApduData(sentCommands[1]!)).toHaveLength(memoSize);

    // Step 3: amount
    expect(getApduP1(sentCommands[2]!)).toBe(P1.AMOUNT);
    expect(getApduData(sentCommands[2]!)).toHaveLength(AMOUNT_LENGTH);

    expect(isSuccessCommandResult(result)).toBe(true);
    if (isSuccessCommandResult(result)) {
      expect(result.data).toStrictEqual(signature);
    }
  });

  it("should chunk large memo across multiple APDU commands", async () => {
    const memoSize = 600;
    const transaction = buildTransaction(memoSize);
    const signature = new Uint8Array(64).fill(0xcd);
    const expectedMemoChunks = Math.ceil(memoSize / APDU_MAX_PAYLOAD);

    // 1 header + N memo chunks + 1 amount
    const results = [
      CommandResultFactory({ data: new Uint8Array(0) }), // header
      ...Array.from({ length: expectedMemoChunks }, () =>
        CommandResultFactory({ data: new Uint8Array(0) }),
      ),
      CommandResultFactory({ data: signature }), // amount
    ];
    captureCommands(...results);

    const task = new SendTransferWithMemoTask(
      apiMock,
      { derivationPath: DERIVATION_PATH, transaction },
      loggerMock,
    );

    const result = await task.run();

    // 1 header + expectedMemoChunks memo + 1 amount
    expect(sentCommands).toHaveLength(1 + expectedMemoChunks + 1);

    // Verify all memo chunks use P1.MEMO
    for (let i = 1; i <= expectedMemoChunks; i++) {
      expect(getApduP1(sentCommands[i]!)).toBe(P1.MEMO);
    }

    // Full memo chunks should be APDU_MAX_PAYLOAD, last may be shorter
    for (let i = 1; i < expectedMemoChunks; i++) {
      expect(getApduData(sentCommands[i]!)).toHaveLength(APDU_MAX_PAYLOAD);
    }
    const lastMemoChunkSize = memoSize % APDU_MAX_PAYLOAD || APDU_MAX_PAYLOAD;
    expect(getApduData(sentCommands[expectedMemoChunks]!)).toHaveLength(
      lastMemoChunkSize,
    );

    expect(isSuccessCommandResult(result)).toBe(true);
    if (isSuccessCommandResult(result)) {
      expect(result.data).toStrictEqual(signature);
    }
  });

  it("should prepend derivation path to header payload", async () => {
    const transaction = buildTransaction(5);
    const signature = new Uint8Array(64).fill(0xee);

    captureCommands(
      CommandResultFactory({ data: new Uint8Array(0) }),
      CommandResultFactory({ data: new Uint8Array(0) }),
      CommandResultFactory({ data: signature }),
    );

    const task = new SendTransferWithMemoTask(
      apiMock,
      { derivationPath: DERIVATION_PATH, transaction },
      loggerMock,
    );

    await task.run();

    const headerData = getApduData(sentCommands[0]!);
    // First byte of path is length (5 elements)
    expect(headerData[0]).toBe(5);
  });

  it("should return error when header step fails", async () => {
    const transaction = buildTransaction(10);

    captureCommands(
      CommandResultFactory({
        error: new ConcordiumAppCommandError({
          message: "User rejected",
          errorCode: ConcordiumErrorCodes.USER_REJECTED,
        }),
      }),
    );

    const task = new SendTransferWithMemoTask(
      apiMock,
      { derivationPath: DERIVATION_PATH, transaction },
      loggerMock,
    );

    const result = await task.run();

    expect(sentCommands).toHaveLength(1);
    expect(isSuccessCommandResult(result)).toBe(false);
    if (!isSuccessCommandResult(result)) {
      expect(result.error).toBeInstanceOf(ConcordiumAppCommandError);
    }
  });

  it("should return error when memo step fails", async () => {
    const transaction = buildTransaction(10);

    captureCommands(
      CommandResultFactory({ data: new Uint8Array(0) }),
      CommandResultFactory({
        error: new ConcordiumAppCommandError({
          message: "Data invalid",
          errorCode: ConcordiumErrorCodes.DATA_INVALID,
        }),
      }),
    );

    const task = new SendTransferWithMemoTask(
      apiMock,
      { derivationPath: DERIVATION_PATH, transaction },
      loggerMock,
    );

    const result = await task.run();

    expect(sentCommands).toHaveLength(2);
    expect(isSuccessCommandResult(result)).toBe(false);
  });

  it("should return error when amount step fails", async () => {
    const transaction = buildTransaction(10);

    captureCommands(
      CommandResultFactory({ data: new Uint8Array(0) }),
      CommandResultFactory({ data: new Uint8Array(0) }),
      CommandResultFactory({
        error: new ConcordiumAppCommandError({
          message: "User rejected",
          errorCode: ConcordiumErrorCodes.USER_REJECTED,
        }),
      }),
    );

    const task = new SendTransferWithMemoTask(
      apiMock,
      { derivationPath: DERIVATION_PATH, transaction },
      loggerMock,
    );

    const result = await task.run();

    expect(sentCommands).toHaveLength(3);
    expect(isSuccessCommandResult(result)).toBe(false);
  });

  it("should return error when memoLength exceeds remaining bytes", async () => {
    // Build a valid-looking transaction but corrupt the memoLength to be too large
    const realMemoSize = 10;
    const tx = buildTransaction(realMemoSize);
    // Overwrite memoLength field (at offset 61+32 = 93) with a value much larger than actual memo
    const memoLenOffset = HEADER_LENGTH + RECIPIENT_LENGTH;
    tx[memoLenOffset] = 0x03; // 0x0300 = 768, way larger than remaining bytes
    tx[memoLenOffset + 1] = 0x00;

    const task = new SendTransferWithMemoTask(
      apiMock,
      { derivationPath: DERIVATION_PATH, transaction: tx },
      loggerMock,
    );

    const result = await task.run();

    expect(sentCommands).toHaveLength(0);
    expect(isSuccessCommandResult(result)).toBe(false);
    if (!isSuccessCommandResult(result)) {
      expect(result.error).toBeInstanceOf(InvalidStatusWordError);
    }
  });

  it("should return error for transaction that is too short", async () => {
    const shortTx = new Uint8Array(50);

    const task = new SendTransferWithMemoTask(
      apiMock,
      { derivationPath: DERIVATION_PATH, transaction: shortTx },
      loggerMock,
    );

    const result = await task.run();

    expect(sentCommands).toHaveLength(0);
    expect(isSuccessCommandResult(result)).toBe(false);
    if (!isSuccessCommandResult(result)) {
      expect(result.error).toBeInstanceOf(InvalidStatusWordError);
    }
  });
});
