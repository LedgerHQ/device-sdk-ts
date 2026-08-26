import {
  APDU_MAX_PAYLOAD,
  CommandResultFactory,
  type InternalApi,
  isSuccessCommandResult,
  type LoggerPublisherService,
} from "@ledgerhq/device-management-kit";
import { Just, Nothing } from "purify-ts";
import { vi } from "vitest";

import { type SignTransactionCommand } from "@internal/app-binder/command/SignTransactionCommand";
import { XrpAppCommandError } from "@internal/app-binder/command/utils/xrpApplicationErrors";

import { SendSignTransactionTask } from "./SendSignTransactionTask";

const DERIVATION_PATH = "44'/144'/0'/0/0";
const SIGNATURE = Uint8Array.from([0x30, 0x44, 0x02, 0x20, 0x01, 0x02]);

// `[nDerivations][index x n]` ahead of the transaction bytes.
const prefixLength = (elements: number) => 1 + elements * 4;
const PREFIX = prefixLength(5);

// How many transaction bytes the first APDU can still hold.
const FIRST_CHUNK_BUDGET = APDU_MAX_PAYLOAD - PREFIX;

const loggerFactory = () =>
  ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    subscribers: [],
  }) as unknown as LoggerPublisherService;

/** A transaction of `length` bytes, each byte distinct enough to spot a slice. */
const transactionOfLength = (length: number) =>
  Uint8Array.from({ length }, (_, i) => i & 0xff);

/**
 * Drive the task against a stubbed device that acknowledges every chunk and
 * answers the last one with a signature, then return the APDUs it emitted.
 */
const runTask = async (
  serializedTransaction: Uint8Array,
  {
    derivationPath = DERIVATION_PATH,
    failAtChunk,
  }: { derivationPath?: string; failAtChunk?: number } = {},
) => {
  const commands: SignTransactionCommand[] = [];
  let call = 0;

  const sendCommand = vi.fn((command: SignTransactionCommand) => {
    commands.push(command);
    const index = call++;

    if (failAtChunk !== undefined && index === failAtChunk) {
      return Promise.resolve(
        CommandResultFactory({
          error: new XrpAppCommandError({
            message: "Condition of use not satisfied (Rejected by user)",
            errorCode: "6985",
          }),
        }),
      );
    }

    // The app answers a signature only on the final chunk, which is the one
    // whose P1 does not carry the "more to come" bit.
    const isLast = command.getApdu().getRawApdu()[2]! < 0x80;
    return Promise.resolve(
      CommandResultFactory({ data: isLast ? Just(SIGNATURE) : Nothing }),
    );
  });

  const api = { sendCommand } as unknown as InternalApi;
  const result = await new SendSignTransactionTask(api, {
    derivationPath,
    serializedTransaction,
    loggerFactory,
  }).run();

  const apdus = commands.map((c) => c.getApdu().getRawApdu());
  return {
    result,
    apdus,
    p1s: apdus.map((a) => a[2]),
    // The data each APDU carried, past the 5 byte header.
    payloads: apdus.map((a) => a.slice(5)),
  };
};

describe("SendSignTransactionTask", () => {
  describe("a transaction fitting one APDU", () => {
    it("should send a single first-and-last chunk and return the signature", async () => {
      // GIVEN a transaction that exactly fills one payload alongside the path
      const { result, apdus, p1s } = await runTask(
        transactionOfLength(FIRST_CHUNK_BUDGET),
      );

      // THEN
      expect(apdus).toHaveLength(1);
      expect(p1s).toStrictEqual([0x00]);
      expect(apdus[0]![4]).toBe(APDU_MAX_PAYLOAD);
      if (!isSuccessCommandResult(result)) {
        assert.fail("Expected a success");
      }
      expect(result.data).toStrictEqual(SIGNATURE);
    });
  });

  describe("the payload boundary", () => {
    it("should stay on one chunk when the payload is exactly full", async () => {
      // WHEN
      const { p1s } = await runTask(transactionOfLength(FIRST_CHUNK_BUDGET));

      // THEN
      expect(p1s).toStrictEqual([0x00]);
    });

    it("should split into two chunks one byte later", async () => {
      // GIVEN one byte more than a single payload holds
      const { apdus, p1s } = await runTask(
        transactionOfLength(FIRST_CHUNK_BUDGET + 1),
      );

      // THEN the first chunk announces more, the second closes the sequence
      expect(p1s).toStrictEqual([0x80, 0x01]);
      expect(apdus[0]![4]).toBe(APDU_MAX_PAYLOAD);
      expect(apdus[1]![4]).toBe(1);
    });
  });

  it("should emit 80, 81... 01 across three or more chunks", async () => {
    // GIVEN a payload spanning four chunks
    const { p1s } = await runTask(
      transactionOfLength(APDU_MAX_PAYLOAD * 3 + 10),
    );

    // THEN
    expect(p1s).toStrictEqual([0x80, 0x81, 0x81, 0x01]);
  });

  it("should shrink the first chunk's transaction budget for a 10 element path", async () => {
    // GIVEN the longest path the app accepts
    const longPath = "44'/144'/0'/0/0/0/0/0/0/0";
    const longPrefix = prefixLength(10);
    const transactionLength = APDU_MAX_PAYLOAD * 2;
    const { apdus } = await runTask(transactionOfLength(transactionLength), {
      derivationPath: longPath,
    });

    // THEN the first APDU is still full, but carries fewer transaction bytes,
    // so what spills into the following chunks grows by the same amount.
    expect(apdus[0]![4]).toBe(APDU_MAX_PAYLOAD);
    expect(apdus[0]!.slice(5, 6)).toStrictEqual(Uint8Array.from([10]));
    expect(apdus[1]![4]).toBe(APDU_MAX_PAYLOAD);
    expect(apdus[2]![4]).toBe(longPrefix);
  });

  describe("what reaches the device", () => {
    it("should reassemble to the encoded path followed by the transaction", async () => {
      // GIVEN a transaction spanning several chunks
      const transaction = transactionOfLength(APDU_MAX_PAYLOAD * 2 + 7);

      // WHEN
      const { payloads } = await runTask(transaction);

      // THEN concatenating every chunk gives back exactly what the app has to
      // read: the encoded path, then the transaction, with nothing repeated
      // and nothing dropped at the seams.
      const sent = Uint8Array.from(payloads.flatMap((p) => Array.from(p)));
      const expected = Uint8Array.from([
        0x05,
        0x80,
        0x00,
        0x00,
        0x2c,
        0x80,
        0x00,
        0x00,
        0x90,
        0x80,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        0x00,
        ...transaction,
      ]);
      expect(sent).toStrictEqual(expected);
    });

    it("should never exceed the APDU payload limit", async () => {
      // WHEN
      const { payloads } = await runTask(
        transactionOfLength(APDU_MAX_PAYLOAD * 3 + 42),
      );

      // THEN
      payloads.forEach((payload) => {
        expect(payload.length).toBeLessThanOrEqual(APDU_MAX_PAYLOAD);
      });
    });
  });

  it("should propagate an error raised mid-loop and stop sending", async () => {
    // GIVEN the device rejects on the second of four chunks
    const { result, apdus } = await runTask(
      transactionOfLength(APDU_MAX_PAYLOAD * 3 + 10),
      { failAtChunk: 1 },
    );

    // THEN
    if (isSuccessCommandResult(result)) {
      assert.fail("Expected an error");
    }
    expect((result.error as XrpAppCommandError).errorCode).toBe("6985");
    expect(apdus).toHaveLength(2);
  });

  it("should reject an empty transaction without sending anything", async () => {
    // WHEN
    const { result, apdus } = await runTask(new Uint8Array(0));

    // THEN
    if (isSuccessCommandResult(result)) {
      assert.fail("Expected an error");
    }
    expect(result.error).toEqual(
      expect.objectContaining({
        originalError: new Error("Cannot sign an empty transaction"),
      }),
    );
    expect(apdus).toHaveLength(0);
  });

  it("should reject a derivation path longer than 10 elements", async () => {
    // WHEN
    const { result, apdus } = await runTask(transactionOfLength(10), {
      derivationPath: "44'/144'/0'/0/0/0/0/0/0/0/0",
    });

    // THEN
    if (isSuccessCommandResult(result)) {
      assert.fail("Expected an error");
    }
    expect(apdus).toHaveLength(0);
  });
});
