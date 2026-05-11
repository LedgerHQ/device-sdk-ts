import {
  type Command,
  CommandResultFactory,
  DeviceModelId,
  DeviceSessionStateType,
  type InternalApi,
  isSuccessCommandResult,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { vi } from "vitest";

import { InvalidMaxFeeError } from "@internal/app-binder/command/utils/InvalidMaxFeeError";
import { UnsupportedTransactionTypeError } from "@internal/app-binder/command/utils/UnsupportedTransactionTypeError";
import { createSignTransactionTask } from "@internal/app-binder/task/SignTransactionTaskFactory";

const DERIVATION_PATH = "44'/919'/0'/0'/0'";
const TYPE_OFFSET = 60;

function buildTransaction(typeValue: number): Uint8Array {
  const tx = new Uint8Array(101).fill(0x00);
  tx[TYPE_OFFSET] = typeValue;
  return tx;
}

function makeReadyDeviceState(appVersion: string) {
  return {
    sessionStateType: DeviceSessionStateType.ReadyWithoutSecureChannel,
    deviceModelId: DeviceModelId.NANO_X,
    currentApp: { name: "Concordium", version: appVersion },
  };
}

function makeApiMock(deviceState: unknown): {
  api: InternalApi;
  sentCommands: Command<unknown, unknown>[];
} {
  const sentCommands: Command<unknown, unknown>[] = [];
  const sendCommandMock = vi
    .fn()
    .mockImplementation((cmd: Command<unknown, unknown>) => {
      sentCommands.push(cmd);
      return Promise.resolve(
        CommandResultFactory({ data: new Uint8Array(64).fill(0xab) }),
      );
    });
  const api = {
    sendCommand: sendCommandMock,
    getDeviceSessionState: () => deviceState,
  } as unknown as InternalApi;
  return { api, sentCommands };
}

function getApduP2(cmd: Command<unknown, unknown>): number {
  return cmd.getApdu().getRawApdu()[3]!;
}

describe("createSignTransactionTask", () => {
  let loggerFactory: (tag: string) => LoggerPublisherService;
  let loggerTags: string[];

  beforeEach(() => {
    loggerTags = [];
    loggerFactory = (tag: string) => {
      loggerTags.push(tag);
      return { debug: vi.fn() } as unknown as LoggerPublisherService;
    };
  });

  it("should create SendTransferTask for Transfer type (3)", () => {
    const { api } = makeApiMock(makeReadyDeviceState("5.6.0"));
    const transaction = buildTransaction(3);

    createSignTransactionTask(
      api,
      { derivationPath: DERIVATION_PATH, transaction, maxFee: 0n },
      loggerFactory,
    );

    expect(loggerTags).toContain("SendTransferTask");
  });

  it("should create SendTransferWithMemoTask for TransferWithMemo type (22)", () => {
    const { api } = makeApiMock(makeReadyDeviceState("5.6.0"));
    const transaction = buildTransaction(22);

    createSignTransactionTask(
      api,
      { derivationPath: DERIVATION_PATH, transaction, maxFee: 0n },
      loggerFactory,
    );

    expect(loggerTags).toContain("SendTransferWithMemoTask");
  });

  it("should return error for unsupported transaction type", async () => {
    const { api } = makeApiMock(makeReadyDeviceState("5.6.0"));
    const transaction = buildTransaction(99);

    const task = createSignTransactionTask(
      api,
      { derivationPath: DERIVATION_PATH, transaction, maxFee: 0n },
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
    const { api } = makeApiMock(makeReadyDeviceState("5.6.0"));
    const transaction = new Uint8Array(10);

    const task = createSignTransactionTask(
      api,
      { derivationPath: DERIVATION_PATH, transaction, maxFee: 0n },
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
    const { api } = makeApiMock(makeReadyDeviceState("5.6.0"));
    const transaction = new Uint8Array(TYPE_OFFSET);

    const task = createSignTransactionTask(
      api,
      { derivationPath: DERIVATION_PATH, transaction, maxFee: 0n },
      loggerFactory,
    );

    const result = await task();

    expect(isSuccessCommandResult(result)).toBe(false);
    if (!isSuccessCommandResult(result)) {
      expect(result.error).toBeInstanceOf(UnsupportedTransactionTypeError);
    }
  });

  describe("fee-display capability detection", () => {
    it("forwards supportsFeeDisplay=true when device app version >= 5.6.0 (Transfer)", async () => {
      const { api, sentCommands } = makeApiMock(makeReadyDeviceState("5.6.0"));
      const transaction = buildTransaction(3);

      await createSignTransactionTask(
        api,
        { derivationPath: DERIVATION_PATH, transaction, maxFee: 1000n },
        loggerFactory,
      )();

      // Simple transfer sends a single APDU; P2=0x01 means fee display was enabled.
      expect(sentCommands).toHaveLength(1);
      expect(getApduP2(sentCommands[0]!)).toBe(0x01);
    });

    it("forwards supportsFeeDisplay=false when device app version < 5.6.0 (Transfer)", async () => {
      const { api, sentCommands } = makeApiMock(makeReadyDeviceState("5.5.9"));
      const transaction = buildTransaction(3);

      await createSignTransactionTask(
        api,
        { derivationPath: DERIVATION_PATH, transaction, maxFee: 1000n },
        loggerFactory,
      )();

      expect(sentCommands).toHaveLength(1);
      expect(getApduP2(sentCommands[0]!)).toBe(0x00);
    });

    it("falls back to legacy when device session has no active Concordium app", async () => {
      const { api, sentCommands } = makeApiMock({
        sessionStateType: DeviceSessionStateType.Connected,
        deviceModelId: DeviceModelId.NANO_X,
      });
      const transaction = buildTransaction(3);

      await createSignTransactionTask(
        api,
        { derivationPath: DERIVATION_PATH, transaction, maxFee: 1000n },
        loggerFactory,
      )();

      expect(sentCommands).toHaveLength(1);
      expect(getApduP2(sentCommands[0]!)).toBe(0x00);
    });

    it("forwards supportsFeeDisplay=true on initial step for TransferWithMemo when version >= 5.6.0", async () => {
      const { api, sentCommands } = makeApiMock(makeReadyDeviceState("5.6.0"));
      // Build a minimal TransferWithMemo: header(61) + recipient(32) + memoLen(2)=0 + amount(8) = 103
      const transaction = new Uint8Array(61 + 32 + 2 + 8);
      transaction[TYPE_OFFSET] = 22;

      await createSignTransactionTask(
        api,
        { derivationPath: DERIVATION_PATH, transaction, maxFee: 1000n },
        loggerFactory,
      )();

      // First sent APDU is the initial step
      expect(sentCommands.length).toBeGreaterThanOrEqual(1);
      expect(getApduP2(sentCommands[0]!)).toBe(0x01);
    });
  });

  describe("maxFee validation", () => {
    const UINT64_MAX = 0xffffffffffffffffn;

    it("rejects negative maxFee with InvalidMaxFeeError on supported firmware", async () => {
      const { api, sentCommands } = makeApiMock(makeReadyDeviceState("5.6.0"));
      const transaction = buildTransaction(3);

      const result = await createSignTransactionTask(
        api,
        { derivationPath: DERIVATION_PATH, transaction, maxFee: -1n },
        loggerFactory,
      )();

      expect(sentCommands).toHaveLength(0);
      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        expect(result.error).toBeInstanceOf(InvalidMaxFeeError);
      }
    });

    it("rejects negative maxFee with InvalidMaxFeeError on legacy firmware", async () => {
      const { api, sentCommands } = makeApiMock(makeReadyDeviceState("5.5.9"));
      const transaction = buildTransaction(3);

      const result = await createSignTransactionTask(
        api,
        { derivationPath: DERIVATION_PATH, transaction, maxFee: -1n },
        loggerFactory,
      )();

      expect(sentCommands).toHaveLength(0);
      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        expect(result.error).toBeInstanceOf(InvalidMaxFeeError);
      }
    });

    it("rejects maxFee above uint64 range", async () => {
      const { api, sentCommands } = makeApiMock(makeReadyDeviceState("5.6.0"));
      const transaction = buildTransaction(3);

      const result = await createSignTransactionTask(
        api,
        {
          derivationPath: DERIVATION_PATH,
          transaction,
          maxFee: UINT64_MAX + 1n,
        },
        loggerFactory,
      )();

      expect(sentCommands).toHaveLength(0);
      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        expect(result.error).toBeInstanceOf(InvalidMaxFeeError);
      }
    });

    it("rejects non-bigint maxFee (defends against untyped JS callers)", async () => {
      const { api, sentCommands } = makeApiMock(makeReadyDeviceState("5.6.0"));
      const transaction = buildTransaction(3);

      const result = await createSignTransactionTask(
        api,
        {
          derivationPath: DERIVATION_PATH,
          transaction,
          // Simulates a JS caller passing an options object as the 3rd arg.
          maxFee: { skipOpenApp: true } as unknown as bigint,
        },
        loggerFactory,
      )();

      expect(sentCommands).toHaveLength(0);
      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        expect(result.error).toBeInstanceOf(InvalidMaxFeeError);
      }
    });

    it("accepts maxFee = 0n as a valid uint64 value", async () => {
      const { api, sentCommands } = makeApiMock(makeReadyDeviceState("5.6.0"));
      const transaction = buildTransaction(3);

      const result = await createSignTransactionTask(
        api,
        { derivationPath: DERIVATION_PATH, transaction, maxFee: 0n },
        loggerFactory,
      )();

      expect(sentCommands).toHaveLength(1);
      expect(isSuccessCommandResult(result)).toBe(true);
    });

    it("accepts maxFee at uint64 max boundary", async () => {
      const { api, sentCommands } = makeApiMock(makeReadyDeviceState("5.6.0"));
      const transaction = buildTransaction(3);

      const result = await createSignTransactionTask(
        api,
        { derivationPath: DERIVATION_PATH, transaction, maxFee: UINT64_MAX },
        loggerFactory,
      )();

      expect(sentCommands).toHaveLength(1);
      expect(isSuccessCommandResult(result)).toBe(true);
    });
  });
});
