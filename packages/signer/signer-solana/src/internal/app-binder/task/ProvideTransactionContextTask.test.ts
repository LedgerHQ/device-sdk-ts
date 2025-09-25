/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */

import { ClearSignContextType } from "@ledgerhq/context-module";
import { CommandResultFactory } from "@ledgerhq/device-management-kit";
import { LoadCertificateCommand } from "@ledgerhq/device-management-kit";
import { Nothing } from "purify-ts";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { ProvideTLVDescriptorCommand } from "@internal/app-binder/command/ProvideTLVDescriptorCommand";
import { ProvideTrustedDynamicDescriptorCommand } from "@internal/app-binder/command/ProvideTrustedDynamicDescriptorCommand";

import { ProvideSolanaTransactionContextTask } from "./ProvideTransactionContextTask";

describe("ProvideSolanaTransactionContextTask", () => {
  let api: { sendCommand: Mock };
  const success = CommandResultFactory({ data: undefined });

  const baseCert = {
    payload: new Uint8Array([0xde, 0xad, 0xbe, 0xef]),
    keyUsageNumber: 1,
  } as const;
  const tlvDescriptor = new Uint8Array([0xaa, 0xbb, 0xcc]);

  const tokenCert = {
    payload: new Uint8Array([0xca, 0xfe, 0xba, 0xbe]),
    keyUsageNumber: 2,
  } as const;

  const tokenDescriptor = {
    data: "deadbeef",
    signature: "01020304",
  } as const;

  beforeEach(() => {
    vi.resetAllMocks();
    api = {
      sendCommand: vi.fn(),
    };
  });

  it("sends PKI certificate then TLV descriptor and returns Nothing (no loaders results)", async () => {
    // Arrange
    api.sendCommand
      .mockResolvedValueOnce(success) // LoadCertificateCommand (trusted name PKI)
      .mockResolvedValueOnce(success); // ProvideTLVDescriptorCommand

    const context = {
      trustedNamePKICertificate: baseCert,
      tlvDescriptor,
      loadersResults: [],
    };

    const task = new ProvideSolanaTransactionContextTask(
      api as unknown as any,
      context as any,
    );

    // Act
    const result = await task.run();

    // Assert
    expect(api.sendCommand).toHaveBeenCalledTimes(2);

    const first = api.sendCommand.mock.calls[0]![0]!;
    expect(first).toBeInstanceOf(LoadCertificateCommand);
    expect(first.args.certificate).toStrictEqual(baseCert.payload);
    expect(first.args.keyUsage).toBe(baseCert.keyUsageNumber);

    const second = api.sendCommand.mock.calls[1]![0]!;
    expect(second).toBeInstanceOf(ProvideTLVDescriptorCommand);
    expect(second.args.payload).toStrictEqual(tlvDescriptor);

    expect(result).toStrictEqual(Nothing);
  });

  it("when token metadata present, sends token certificate then dynamic descriptor", async () => {
    // Arrange
    api.sendCommand
      .mockResolvedValueOnce(success) // base PKI certificate
      .mockResolvedValueOnce(success) // TLV descriptor
      .mockResolvedValueOnce(success) // token metadata certificate
      .mockResolvedValueOnce(success); // dynamic descriptor

    const loadersResults = [
      {
        type: ClearSignContextType.SOLANA_TOKEN,
        payload: {
          solanaTokenDescriptor: tokenDescriptor,
        },
        certificate: tokenCert,
      },
    ];

    const context = {
      trustedNamePKICertificate: baseCert,
      tlvDescriptor,
      loadersResults,
    };

    const task = new ProvideSolanaTransactionContextTask(
      api as unknown as any,
      context as any,
    );

    // Act
    const result = await task.run();

    // Assert
    expect(api.sendCommand).toHaveBeenCalledTimes(4);

    const third = api.sendCommand.mock.calls[2]![0]!;
    expect(third).toBeInstanceOf(LoadCertificateCommand);
    expect(third.args.certificate).toStrictEqual(tokenCert.payload);
    expect(third.args.keyUsage).toBe(tokenCert.keyUsageNumber);

    const fourth = api.sendCommand.mock.calls[3]![0]!;
    expect(fourth).toBeInstanceOf(ProvideTrustedDynamicDescriptorCommand);
    expect(fourth.args.data).toBe(tokenDescriptor.data);
    expect(fourth.args.signature).toBe(tokenDescriptor.signature);

    expect(result).toStrictEqual(Nothing);
  });

  it("does not send token commands if token payload is missing", async () => {
    // Arrange
    api.sendCommand
      .mockResolvedValueOnce(success)
      .mockResolvedValueOnce(success);

    const loadersResults = [
      {
        type: ClearSignContextType.SOLANA_TOKEN,
        payload: undefined, // missing payload
        certificate: tokenCert,
      },
    ];

    const context = {
      trustedNamePKICertificate: baseCert,
      tlvDescriptor,
      loadersResults,
    };

    const task = new ProvideSolanaTransactionContextTask(
      api as unknown as any,
      context as any,
    );

    // Act
    const result = await task.run();

    // Assert
    expect(api.sendCommand).toHaveBeenCalledTimes(2);
    expect(result).toStrictEqual(Nothing);
  });

  it("does not send token commands if token certificate is missing", async () => {
    // Arrange
    api.sendCommand
      .mockResolvedValueOnce(success)
      .mockResolvedValueOnce(success);

    const loadersResults = [
      {
        type: ClearSignContextType.SOLANA_TOKEN,
        payload: { solanaTokenDescriptor: tokenDescriptor },
        certificate: undefined, // missing cert
      },
    ];

    const context = {
      trustedNamePKICertificate: baseCert,
      tlvDescriptor,
      loadersResults,
    };

    const task = new ProvideSolanaTransactionContextTask(
      api as unknown as any,
      context as any,
    );

    // Act
    const result = await task.run();

    // Assert
    expect(api.sendCommand).toHaveBeenCalledTimes(2);
    expect(result).toStrictEqual(Nothing);
  });

  it("throws a mapped error when sending token certificate returns a CommandErrorResult", async () => {
    // Arrange
    const errorResult = CommandResultFactory({
      error: { _tag: "SomeError", errorCode: 0x6a80, message: "Bad stuff" },
    });

    api.sendCommand
      .mockResolvedValueOnce(success) // base PKI certificate
      .mockResolvedValueOnce(success) // TLV descriptor
      .mockResolvedValueOnce(errorResult); // token certificate -> returns error (not success)

    const loadersResults = [
      {
        type: ClearSignContextType.SOLANA_TOKEN,
        payload: { solanaTokenDescriptor: tokenDescriptor },
        certificate: tokenCert,
      },
    ];

    const context = {
      trustedNamePKICertificate: baseCert,
      tlvDescriptor,
      loadersResults,
    };

    const task = new ProvideSolanaTransactionContextTask(
      api as unknown as any,
      context as any,
    );

    // Act + Assert
    await expect(task.run()).rejects.toThrow(
      "[SignerSolana] ProvideSolanaTransactionContextTask: Failed to send tokenMetadataCertificate to device",
    );

    // ensure the dynamic descriptor was NOT attempted
    expect(api.sendCommand).toHaveBeenCalledTimes(3);
    const third = api.sendCommand.mock.calls[2]![0]!;
    expect(third).toBeInstanceOf(LoadCertificateCommand);
  });

  it("propagates a rejection thrown by InternalApi.sendCommand (e.g., base PKI send)", async () => {
    // Arrange: make the first call reject (throw)
    api.sendCommand.mockRejectedValueOnce(new Error("transport failure"));

    const context = {
      trustedNamePKICertificate: baseCert,
      tlvDescriptor,
      loadersResults: [],
    };

    const task = new ProvideSolanaTransactionContextTask(
      api as unknown as any,
      context as any,
    );

    await expect(task.run()).rejects.toThrow("transport failure");
    expect(api.sendCommand).toHaveBeenCalledTimes(1);
  });

  it("propagates a rejection thrown by InternalApi.sendCommand when sending TLV", async () => {
    // Arrange: PKI ok, TLV rejects
    api.sendCommand
      .mockResolvedValueOnce(success)
      .mockRejectedValueOnce(new Error("apdu error"));

    const context = {
      trustedNamePKICertificate: baseCert,
      tlvDescriptor,
      loadersResults: [],
    };

    const task = new ProvideSolanaTransactionContextTask(
      api as unknown as any,
      context as any,
    );

    await expect(task.run()).rejects.toThrow("apdu error");
    expect(api.sendCommand).toHaveBeenCalledTimes(2);
  });
});
