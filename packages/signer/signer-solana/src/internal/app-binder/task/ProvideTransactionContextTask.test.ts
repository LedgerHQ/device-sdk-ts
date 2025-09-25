/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { CommandResultFactory } from "@ledgerhq/device-management-kit";
import { Nothing } from "purify-ts";
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

  const dummyDescriptor = new Uint8Array([0xaa, 0xaa, 0xaa]);
  const dummyCertificate = {
    payload: new Uint8Array([0xde, 0xad, 0xbe, 0xef]),
    keyUsageNumber: 1,
  } as const;

  const mockError = { _tag: "SomeError", errorCode: 0, message: "SomeError" };

  beforeEach(() => {
    vi.resetAllMocks();
    fakeApi = {
      sendCommand: vi.fn(),
    };

    context = {
      tlvDescriptor: dummyDescriptor,
      trustedNamePKICertificate: dummyCertificate,
    };
  });

  it("returns Nothing when both commands succeed", async () => {
    // given: first PKI success, then TLV success
    const success = CommandResultFactory({ data: null });
    fakeApi.sendCommand
      .mockResolvedValueOnce(success) // ProvideTrustedNamePKICommand
      .mockResolvedValueOnce(success); // ProvideTLVDescriptorCommand

    const task = new ProvideSolanaTransactionContextTask(
      fakeApi as unknown as any,
      context,
    );

    // when
    const result = await task.run();

    // then
    expect(fakeApi.sendCommand).toHaveBeenCalledTimes(2);

    // PKI command
    const firstArg = fakeApi.sendCommand.mock.calls[0]![0]!;
    expect(firstArg).toBeInstanceOf(ProvideTrustedNamePKICommand);
    expect(
      (firstArg as ProvideTrustedNamePKICommand).args.pkiBlob,
    ).toStrictEqual(dummyCertificate.payload);

    // TLV command
    const secondArg = fakeApi.sendCommand.mock.calls[1]![0]!;
    expect(secondArg).toBeInstanceOf(ProvideTLVDescriptorCommand);
    expect(
      (secondArg as ProvideTLVDescriptorCommand).args.payload,
    ).toStrictEqual(dummyDescriptor);

    expect(result).toStrictEqual(Nothing);
  });

  it("throws error if PKI command fails", async () => {
    const errorResult = CommandResultFactory({ error: mockError });
    fakeApi.sendCommand.mockResolvedValueOnce(errorResult);

    const task = new ProvideSolanaTransactionContextTask(
      fakeApi as unknown as any,
      context,
    );

    await expect(task.run()).rejects.toBe(errorResult);
    expect(fakeApi.sendCommand).toHaveBeenCalledTimes(1);
  });

  it("throws error if TLV command fails", async () => {
    const success = CommandResultFactory({ data: null });
    const tlvErrorResult = CommandResultFactory({ error: mockError });

    fakeApi.sendCommand
      .mockResolvedValueOnce(success) // PKI success
      .mockResolvedValueOnce(tlvErrorResult); // TLV fails

    const task = new ProvideSolanaTransactionContextTask(
      fakeApi as unknown as any,
      context,
    );

    await expect(task.run()).rejects.toBe(tlvErrorResult);
    expect(fakeApi.sendCommand).toHaveBeenCalledTimes(2);
  });
});
