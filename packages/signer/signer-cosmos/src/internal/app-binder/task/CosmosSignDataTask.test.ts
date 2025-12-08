import {
  APDU_MAX_PAYLOAD,
  CommandResultFactory,
  type InternalApi,
  InvalidStatusWordError,
  isSuccessCommandResult,
} from "@ledgerhq/device-management-kit";
import { Just, Nothing } from "purify-ts";
import { beforeEach, describe, expect, it, type Mocked } from "vitest";

import { type Signature } from "@api/model/Signature";
import { SignTransactionCommand } from "@internal/app-binder/command/SignTransactionCommand";
import { makeDeviceActionInternalApiMock } from "@internal/app-binder/device-action/__test-utils__/makeInternalApi";
import { CosmosSignDataTask } from "@internal/app-binder/task/CosmosSignDataTask";

describe("CosmosSignDataTask", () => {
  let apiMock: Mocked<InternalApi>;

  beforeEach(() => {
    apiMock = makeDeviceActionInternalApiMock();
  });

  const defaultDerivation = "44'/118'/0'/0/0";
  const defaultPrefix = "cosmos";

  it("streams chunks and returns final signature (happy path)", async () => {
    const txLength = APDU_MAX_PAYLOAD + 10; // add chunks beyond max payload
    const serializedTransaction = new Uint8Array(txLength).fill(0xff);
    const chunkCount = Math.ceil(txLength / APDU_MAX_PAYLOAD);
    const signature: Signature = new Uint8Array([0x1, 0x2, 0x3]);

    // 1. init: result
    apiMock.sendCommand.mockResolvedValueOnce(
      CommandResultFactory({
        data: Nothing,
      }),
    );

    // 2. intermediate: add chunks, all Nothing
    for (let i = 0; i < chunkCount - 1; i++) {
      apiMock.sendCommand.mockResolvedValueOnce(
        CommandResultFactory({
          data: Nothing,
        }),
      );
    }

    // 3. last chunk: returns signature
    apiMock.sendCommand.mockResolvedValueOnce(
      CommandResultFactory({
        data: Just(signature),
      }),
    );

    const task = new CosmosSignDataTask(apiMock, {
      derivationPath: defaultDerivation,
      prefix: defaultPrefix,
      serializedTransaction,
    });

    const res = await task.run();
    const isSuccessful = isSuccessCommandResult(res);
    expect(isSuccessful).toBe(true);
    if (isSuccessful) {
      expect(res.data).toEqual(signature);
    }

    expect(apiMock.sendCommand).toHaveBeenCalledTimes(1 + chunkCount);
    const firstCallArg = apiMock.sendCommand.mock.calls.at(0)?.[0];
    expect(firstCallArg).toBeInstanceOf(SignTransactionCommand);
    const lastCallArg = apiMock.sendCommand.mock.calls.at(-1)?.[0];
    expect(lastCallArg).toBeInstanceOf(SignTransactionCommand);
  });

  it("returns init error if first command fails", async () => {
    const serializedTransaction = new Uint8Array([0xde, 0xad]);
    const initError = new InvalidStatusWordError("init failed");

    apiMock.sendCommand.mockResolvedValueOnce(
      CommandResultFactory({
        error: initError,
      }),
    );

    const task = new CosmosSignDataTask(apiMock, {
      derivationPath: defaultDerivation,
      prefix: defaultPrefix,
      serializedTransaction,
    });

    const res = await task.run();
    const isSuccessful = isSuccessCommandResult(res);
    expect(isSuccessful).toBe(false);
    if (!isSuccessful) {
      expect(res.error).toBe(initError);
    }
    expect(apiMock.sendCommand).toHaveBeenCalledTimes(1);
  });

  it("returns 'Empty transaction' error if serializedTransaction is empty", async () => {
    const serializedTransaction = new Uint8Array([]);

    apiMock.sendCommand.mockResolvedValueOnce(
      CommandResultFactory({
        data: Nothing,
      }),
    );

    const task = new CosmosSignDataTask(apiMock, {
      derivationPath: defaultDerivation,
      prefix: defaultPrefix,
      serializedTransaction,
    });

    const res = await task.run();
    const isSuccessful = isSuccessCommandResult(res);
    expect(isSuccessful).toBe(false);
    if (!isSuccessful) {
      expect(res.error).toBeInstanceOf(InvalidStatusWordError);
      expect((res.error.originalError as Error).message).toBe(
        "Empty transaction",
      );
    }

    expect(apiMock.sendCommand).toHaveBeenCalledTimes(1);
  });

  it("returns chunk error if a non-last chunk fails", async () => {
    const txLength = APDU_MAX_PAYLOAD + 10;
    const serializedTransaction = new Uint8Array(txLength).fill(0x11);
    const midError = new InvalidStatusWordError("mid-chunk failure");

    // init ok
    apiMock.sendCommand.mockResolvedValueOnce(
      CommandResultFactory({
        data: Nothing,
      }),
    );

    // first chunk returns error
    apiMock.sendCommand.mockResolvedValueOnce(
      CommandResultFactory({
        error: midError,
      }),
    );

    const task = new CosmosSignDataTask(apiMock, {
      derivationPath: defaultDerivation,
      prefix: defaultPrefix,
      serializedTransaction,
    });

    const res = await task.run();
    const isSuccessful = isSuccessCommandResult(res);
    expect(isSuccessful).toBe(false);
    if (!isSuccessful) {
      expect(res.error).toBe(midError);
    }

    expect(apiMock.sendCommand).toHaveBeenCalledTimes(2);
  });

  it("returns 'No signature returned' when last chunk has Nothing", async () => {
    const txLength = APDU_MAX_PAYLOAD + 10;
    const serializedTransaction = new Uint8Array(txLength).fill(0x11);
    const chunkCount = Math.ceil(txLength / APDU_MAX_PAYLOAD);

    // init: ok
    apiMock.sendCommand.mockResolvedValueOnce(
      CommandResultFactory({
        data: Nothing,
      }),
    );

    // intermediate chunks: ok
    for (let i = 0; i < chunkCount - 1; i++) {
      apiMock.sendCommand.mockResolvedValueOnce(
        CommandResultFactory({
          data: Nothing,
        }),
      );
    }

    // last chunk: Nothing
    apiMock.sendCommand.mockResolvedValueOnce(
      CommandResultFactory({
        data: Nothing,
      }),
    );

    const task = new CosmosSignDataTask(apiMock, {
      derivationPath: defaultDerivation,
      prefix: defaultPrefix,
      serializedTransaction,
    });

    const res = await task.run();
    const isSuccessful = isSuccessCommandResult(res);
    expect(isSuccessful).toBe(false);
    if (!isSuccessful) {
      expect(res.error).toBeInstanceOf(InvalidStatusWordError);
      expect((res.error.originalError as Error).message).toBe(
        "No signature returned",
      );
    }

    expect(apiMock.sendCommand).toHaveBeenCalledTimes(1 + chunkCount);
  });
});
