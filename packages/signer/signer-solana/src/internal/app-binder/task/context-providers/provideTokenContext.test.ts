/* eslint-disable @typescript-eslint/no-explicit-any */
import { SolanaContextTypes } from "@ledgerhq/context-module";
import {
  CommandResultFactory,
  LoadCertificateCommand,
} from "@ledgerhq/device-management-kit";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { ProvideTLVTransactionInstructionDescriptorCommand } from "@internal/app-binder/command/ProvideTLVTransactionInstructionDescriptorCommand";

import { type ProvideContextDeps } from "./provideContextTypes";
import { provideTokenContext } from "./provideTokenContext";

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
};

describe("provideTokenContext", () => {
  let api: { sendCommand: Mock };
  let deps: ProvideContextDeps;
  const success = CommandResultFactory({ data: undefined });

  const tokenCert = {
    payload: new Uint8Array([0xf0, 0xca, 0xcc, 0x1a]),
    keyUsageNumber: 2,
  } as const;

  const tokenDescriptor = {
    data: "f0cacc1a",
    signature: "01020304",
  } as const;

  beforeEach(() => {
    vi.resetAllMocks();
    api = { sendCommand: vi.fn() };
    deps = {
      api: api as any,
      logger: mockLogger as any,
      normaliser: {} as any,
      transactionBytes: new Uint8Array([0xf0]),
    };
  });

  // test 1: sends certificate then descriptor
  it("sends certificate then TLV transaction-instruction descriptor", async () => {
    api.sendCommand
      .mockResolvedValueOnce(success)
      .mockResolvedValueOnce(success);

    const result = {
      type: SolanaContextTypes.SOLANA_TOKEN as const,
      payload: { solanaTokenDescriptor: tokenDescriptor },
      certificate: tokenCert,
    };

    await provideTokenContext(result, deps);

    expect(api.sendCommand).toHaveBeenCalledTimes(2);

    const certCmd = api.sendCommand.mock.calls[0]![0]!;
    expect(certCmd).toBeInstanceOf(LoadCertificateCommand);
    expect(certCmd.args.certificate).toStrictEqual(tokenCert.payload);
    expect(certCmd.args.keyUsage).toBe(tokenCert.keyUsageNumber);

    const descCmd = api.sendCommand.mock.calls[1]![0]!;
    expect(descCmd).toBeInstanceOf(
      ProvideTLVTransactionInstructionDescriptorCommand,
    );
    expect(descCmd.args.dataHex).toBe(tokenDescriptor.data);
    expect(descCmd.args.signatureHex).toBe(tokenDescriptor.signature);
  });

  // test 2: no commands when payload is missing
  it("does not send commands if payload is missing", async () => {
    const result = {
      type: SolanaContextTypes.SOLANA_TOKEN as const,
      payload: undefined,
      certificate: tokenCert,
    };

    await provideTokenContext(result as any, deps);

    expect(api.sendCommand).not.toHaveBeenCalled();
  });

  // test 3: no commands when certificate is missing
  it("does not send commands if certificate is missing", async () => {
    const result = {
      type: SolanaContextTypes.SOLANA_TOKEN as const,
      payload: { solanaTokenDescriptor: tokenDescriptor },
      certificate: undefined,
    };

    await provideTokenContext(result as any, deps);

    expect(api.sendCommand).not.toHaveBeenCalled();
  });

  // test 4: throws when cert load fails
  it("throws when certificate load returns error", async () => {
    const errorResult = CommandResultFactory({
      error: { _tag: "SomeError", errorCode: 0x6a80, message: "bad" },
    });
    api.sendCommand.mockResolvedValueOnce(errorResult);

    const result = {
      type: SolanaContextTypes.SOLANA_TOKEN as const,
      payload: { solanaTokenDescriptor: tokenDescriptor },
      certificate: tokenCert,
    };

    await expect(provideTokenContext(result, deps)).rejects.toThrow(
      "Failed to send tokenMetadataCertificate to device",
    );

    expect(api.sendCommand).toHaveBeenCalledTimes(1);
  });
});
