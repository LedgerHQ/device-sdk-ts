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
import { UnsupportedAppVersionError } from "@internal/app-binder/command/utils/UnsupportedAppVersionError";
import { UnsupportedTransactionTypeError } from "@internal/app-binder/command/utils/UnsupportedTransactionTypeError";
import { createSignTransactionTask } from "@internal/app-binder/task/SignTransactionTaskFactory";
import { MIN_APP_VERSION_FOR_PLT } from "@internal/shared/ConcordiumAppVersions";

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

  describe("PLT dispatch", () => {
    /** [header:60][kind:1 = 0x1B][tokenIdLength:1][tokenId:3][cborLength:4][cbor:9] */
    function buildPltTransaction(): Uint8Array {
      const cbor = new Uint8Array([
        0x81, 0xa1, 0x65, 0x70, 0x61, 0x75, 0x73, 0x65, 0xa0,
      ]);
      const tokenId = new TextEncoder().encode("PLT");
      const tx = new Uint8Array(60 + 1 + 1 + tokenId.length + 4 + cbor.length);
      tx[TYPE_OFFSET] = 0x1b;
      tx[61] = tokenId.length;
      tx.set(tokenId, 62);
      new DataView(tx.buffer, tx.byteOffset).setUint32(
        62 + tokenId.length,
        cbor.length,
        false,
      );
      tx.set(cbor, 62 + tokenId.length + 4);
      return tx;
    }

    it("should create SendPltTask for TokenUpdate type (0x1B)", () => {
      const { api } = makeApiMock(
        makeReadyDeviceState(MIN_APP_VERSION_FOR_PLT),
      );

      createSignTransactionTask(
        api,
        {
          derivationPath: DERIVATION_PATH,
          transaction: buildPltTransaction(),
          maxFee: 0n,
        },
        loggerFactory,
      );

      expect(loggerTags).toContain("SendPltTask");
    });

    it("should send P2=0x00 on the PLT INIT frame regardless of fee-display support", async () => {
      const { api, sentCommands } = makeApiMock(
        makeReadyDeviceState(MIN_APP_VERSION_FOR_PLT),
      );

      await createSignTransactionTask(
        api,
        {
          derivationPath: DERIVATION_PATH,
          transaction: buildPltTransaction(),
          maxFee: 1000n,
        },
        loggerFactory,
      )();

      expect(sentCommands.length).toBeGreaterThanOrEqual(1);
      expect(getApduP2(sentCommands[0]!)).toBe(0x00);
    });

    it("should reject PLT with UnsupportedAppVersionError on an older app", async () => {
      const { api, sentCommands } = makeApiMock(makeReadyDeviceState("5.6.0"));

      const result = await createSignTransactionTask(
        api,
        {
          derivationPath: DERIVATION_PATH,
          transaction: buildPltTransaction(),
          maxFee: 0n,
        },
        loggerFactory,
      )();

      expect(sentCommands).toHaveLength(0);
      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        expect(result.error).toBeInstanceOf(UnsupportedAppVersionError);
        expect(result.error).not.toBeInstanceOf(
          UnsupportedTransactionTypeError,
        );
        expect((result.error as UnsupportedAppVersionError).message).toContain(
          MIN_APP_VERSION_FOR_PLT,
        );
      }
    });

    it("should reject PLT when the session has no active Concordium app", async () => {
      const { api, sentCommands } = makeApiMock({
        sessionStateType: DeviceSessionStateType.Connected,
        deviceModelId: DeviceModelId.NANO_X,
      });

      const result = await createSignTransactionTask(
        api,
        {
          derivationPath: DERIVATION_PATH,
          transaction: buildPltTransaction(),
          maxFee: 0n,
        },
        loggerFactory,
      )();

      expect(sentCommands).toHaveLength(0);
      expect(isSuccessCommandResult(result)).toBe(false);
      if (!isSuccessCommandResult(result)) {
        expect(result.error).toBeInstanceOf(UnsupportedAppVersionError);
      }
    });
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
