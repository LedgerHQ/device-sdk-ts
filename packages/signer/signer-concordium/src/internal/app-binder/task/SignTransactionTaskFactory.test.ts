import {
  CommandResultFactory,
  type InternalApi,
  isSuccessCommandResult,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { vi } from "vitest";

import { UnsupportedTransactionTypeError } from "@internal/app-binder/command/utils/UnsupportedTransactionTypeError";
import { createSignTransactionTask } from "@internal/app-binder/task/SignTransactionTaskFactory";

const DERIVATION_PATH = "44'/919'/0'/0'/0'";
const TYPE_OFFSET = 60;

function buildTransaction(typeValue: number): Uint8Array {
  const tx = new Uint8Array(101).fill(0x00);
  tx[TYPE_OFFSET] = typeValue;
  return tx;
}

describe("createSignTransactionTask", () => {
  let apiMock: InternalApi;
  let loggerFactory: (tag: string) => LoggerPublisherService;
  let loggerTags: string[];

  beforeEach(() => {
    apiMock = {
      sendCommand: vi
        .fn()
        .mockResolvedValue(CommandResultFactory({ data: new Uint8Array(64) })),
    } as unknown as InternalApi;

    loggerTags = [];
    loggerFactory = (tag: string) => {
      loggerTags.push(tag);
      return { debug: vi.fn() } as unknown as LoggerPublisherService;
    };
  });

  it("should create SendTransferTask for Transfer type (3)", () => {
    const transaction = buildTransaction(3);

    createSignTransactionTask(
      apiMock,
      { derivationPath: DERIVATION_PATH, transaction },
      loggerFactory,
    );

    expect(loggerTags).toContain("SendTransferTask");
  });

  it("should create SendTransferWithMemoTask for TransferWithMemo type (22)", () => {
    const transaction = buildTransaction(22);

    createSignTransactionTask(
      apiMock,
      { derivationPath: DERIVATION_PATH, transaction },
      loggerFactory,
    );

    expect(loggerTags).toContain("SendTransferWithMemoTask");
  });

  it("should return error for unsupported transaction type", async () => {
    const transaction = buildTransaction(99);

    const task = createSignTransactionTask(
      apiMock,
      { derivationPath: DERIVATION_PATH, transaction },
      loggerFactory,
    );

    const result = await task();

    expect(isSuccessCommandResult(result)).toBe(false);
    if (!isSuccessCommandResult(result)) {
      expect(result.error).toBeInstanceOf(UnsupportedTransactionTypeError);
      const err = result.error as UnsupportedTransactionTypeError;
      expect(err.message).toContain("99");
    }
  });

  it("should return error for transaction too short to read type", async () => {
    const transaction = new Uint8Array(10);

    const task = createSignTransactionTask(
      apiMock,
      { derivationPath: DERIVATION_PATH, transaction },
      loggerFactory,
    );

    const result = await task();

    expect(isSuccessCommandResult(result)).toBe(false);
    if (!isSuccessCommandResult(result)) {
      expect(result.error).toBeInstanceOf(UnsupportedTransactionTypeError);
      const err = result.error as UnsupportedTransactionTypeError;
      expect(err.message).toContain("too short");
    }
  });

  it("should return error for transaction exactly at type offset boundary", async () => {
    const transaction = new Uint8Array(TYPE_OFFSET);

    const task = createSignTransactionTask(
      apiMock,
      { derivationPath: DERIVATION_PATH, transaction },
      loggerFactory,
    );

    const result = await task();

    expect(isSuccessCommandResult(result)).toBe(false);
    if (!isSuccessCommandResult(result)) {
      expect(result.error).toBeInstanceOf(UnsupportedTransactionTypeError);
    }
  });
});
