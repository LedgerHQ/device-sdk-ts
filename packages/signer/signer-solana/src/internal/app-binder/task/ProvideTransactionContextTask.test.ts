/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { CommandResultFactory } from "@ledgerhq/device-management-kit";
import { Just, Maybe, Nothing } from "purify-ts";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { ProvideTLVDescriptorCommand } from "@internal/app-binder/command/ProvideTLVDescriptorCommand";
import { ProvideTrustedNamePKICommand } from "@internal/app-binder/command/ProvideTrustedNamePKICommand";

import {
  ProvideSolanaTransactionContextTask,
  type SolanaContextForDevice,
} from "./ProvideTransactionContextTask";

describe("ProvideSolanaTransactionContextTask", () => {
  let fakeApi: { sendCommand: Mock };
  let context: SolanaContextForDevice;

  const dummyDescriptor = Uint8Array.from([0xaa, 0xaa, 0xaa]);
  const dummyCertificate: any = {
    payload: Uint8Array.from([0xde, 0xad, 0xbe, 0xef, 0xde, 0xad, 0xbe, 0xef]),
  };

  const mockError = { _tag: "SomeError", errorCode: 0, message: "SomeError" };

  beforeEach(() => {
    vi.resetAllMocks();
    fakeApi = {
      sendCommand: vi.fn(),
    };
    context = {
      descriptor: dummyDescriptor,
      certificate: dummyCertificate,
    };
  });

  it("returns Nothing when both commands succeed", async () => {
    // given
    const successResult = CommandResultFactory({ data: Maybe.of(null) });
    fakeApi.sendCommand.mockResolvedValue(successResult);

    const task = new ProvideSolanaTransactionContextTask(
      fakeApi as unknown as any,
      context,
    );

    // when
    const result = await task.run();

    // then
    expect(fakeApi.sendCommand).toHaveBeenCalledTimes(2);

    const firstCallCall = fakeApi.sendCommand.mock.calls[0];
    expect(firstCallCall).toBeDefined();
    const firstCallArg = firstCallCall![0];
    expect(firstCallArg).toBeInstanceOf(ProvideTrustedNamePKICommand);
    expect(
      (firstCallArg as ProvideTrustedNamePKICommand).args.pkiBlob,
    ).toStrictEqual(dummyCertificate.payload);

    const secondCallArg = fakeApi.sendCommand.mock.calls[1]![0]!;
    expect(secondCallArg).toBeInstanceOf(ProvideTLVDescriptorCommand);
    expect(
      (secondCallArg as ProvideTLVDescriptorCommand).args.payload,
    ).toStrictEqual(dummyDescriptor);

    expect(result).toStrictEqual(Nothing);
  });

  it("returns Just(error) if PKI command fails", async () => {
    // given
    const errorResult = CommandResultFactory({
      error: mockError,
    });
    fakeApi.sendCommand.mockResolvedValueOnce(errorResult);

    const task = new ProvideSolanaTransactionContextTask(
      fakeApi as unknown as any,
      context,
    );

    // when
    const result = await task.run();

    // then
    expect(fakeApi.sendCommand).toHaveBeenCalledTimes(1);
    expect(result).toStrictEqual(Just(errorResult));
  });

  it("returns Just(error) if TLV command fails", async () => {
    // given
    const successResult = CommandResultFactory({ data: Maybe.of(null) });
    const tlvErrorResult = CommandResultFactory({
      error: mockError,
    });

    fakeApi.sendCommand
      .mockResolvedValueOnce(successResult)
      .mockResolvedValueOnce(tlvErrorResult);

    const task = new ProvideSolanaTransactionContextTask(
      fakeApi as unknown as any,
      context,
    );

    // when
    const result = await task.run();

    // then
    expect(fakeApi.sendCommand).toHaveBeenCalledTimes(2);
    expect(result).toStrictEqual(Just(tlvErrorResult));
  });
});
