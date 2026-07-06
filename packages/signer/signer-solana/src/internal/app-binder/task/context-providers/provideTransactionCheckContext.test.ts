/* eslint-disable @typescript-eslint/no-explicit-any */

import { ClearSignContextType } from "@ledgerhq/context-module";
import {
  APDU_MAX_PAYLOAD,
  CommandResultFactory,
  LoadCertificateCommand,
} from "@ledgerhq/device-management-kit";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { ProvideTransactionCheckCommand } from "@internal/app-binder/command/ProvideTransactionCheckCommand";

import { type ProvideContextDeps } from "./provideContextTypes";
import { provideTransactionCheckContext } from "./provideTransactionCheckContext";

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
};

describe("provideTransactionCheckContext", () => {
  let api: { sendCommand: Mock };
  let deps: ProvideContextDeps;
  const success = CommandResultFactory({ data: undefined });

  const txCheckCert = {
    payload: new Uint8Array([0xde, 0xad]),
    keyUsageNumber: 14,
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

  it("sends certificate then ProvideTransactionCheckCommand", async () => {
    api.sendCommand
      .mockResolvedValueOnce(success)
      .mockResolvedValueOnce(success);

    const result = {
      type: ClearSignContextType.SOLANA_TRANSACTION_CHECK as const,
      payload: { descriptor: "aabbccdd" },
      certificate: txCheckCert,
    };

    await provideTransactionCheckContext(result, deps);

    expect(api.sendCommand).toHaveBeenCalledTimes(2);

    const certCmd = api.sendCommand.mock.calls[0]![0]!;
    expect(certCmd).toBeInstanceOf(LoadCertificateCommand);
    expect(certCmd.args.certificate).toStrictEqual(txCheckCert.payload);
    expect(certCmd.args.keyUsage).toBe(txCheckCert.keyUsageNumber);

    const web3Cmd = api.sendCommand.mock.calls[1]![0]!;
    expect(web3Cmd).toBeInstanceOf(ProvideTransactionCheckCommand);
  });

  it("throws when certificate load fails", async () => {
    const errorResult = CommandResultFactory({
      error: { _tag: "SomeError", errorCode: 0x6a80, message: "bad" },
    });
    api.sendCommand.mockResolvedValueOnce(errorResult);

    const result = {
      type: ClearSignContextType.SOLANA_TRANSACTION_CHECK as const,
      payload: { descriptor: "aabbccdd" },
      certificate: txCheckCert,
    };

    await expect(provideTransactionCheckContext(result, deps)).rejects.toThrow(
      "Failed to send transaction-check certificate to device",
    );
  });

  it("sends descriptor without certificate when certificate is absent", async () => {
    api.sendCommand.mockResolvedValueOnce(success);

    const result = {
      type: ClearSignContextType.SOLANA_TRANSACTION_CHECK as const,
      payload: { descriptor: "aabbccdd" },
      certificate: undefined,
    };

    await provideTransactionCheckContext(result as any, deps);

    expect(api.sendCommand).toHaveBeenCalledTimes(1);

    const web3Cmd = api.sendCommand.mock.calls[0]![0]!;
    expect(web3Cmd).toBeInstanceOf(ProvideTransactionCheckCommand);
  });

  it("chunks large descriptors across multiple APDU calls", async () => {
    api.sendCommand.mockResolvedValue(success);

    const largeDescriptorHex = "aa"
      .repeat(APDU_MAX_PAYLOAD + 10)
      .padEnd((APDU_MAX_PAYLOAD + 10) * 2, "bb");
    const result = {
      type: ClearSignContextType.SOLANA_TRANSACTION_CHECK as const,
      payload: { descriptor: largeDescriptorHex },
      certificate: undefined,
    };

    await provideTransactionCheckContext(result as any, deps);

    expect(api.sendCommand.mock.calls.length).toBeGreaterThanOrEqual(2);

    const allCmds = api.sendCommand.mock.calls.map(
      (c: any[]) => c[0] as ProvideTransactionCheckCommand,
    );
    expect(
      allCmds.every((cmd) => cmd instanceof ProvideTransactionCheckCommand),
    ).toBe(true);
  });

  it("throws when descriptor sending fails", async () => {
    api.sendCommand.mockResolvedValueOnce(
      CommandResultFactory({
        error: { _tag: "SomeError", errorCode: 0x6a80, message: "bad" },
      }),
    );

    const result = {
      type: ClearSignContextType.SOLANA_TRANSACTION_CHECK as const,
      payload: { descriptor: "aabbccdd" },
      certificate: undefined,
    };

    await expect(
      provideTransactionCheckContext(result as any, deps),
    ).rejects.toThrow("Failed to send transaction-check descriptor to device");
  });

  it("warns and returns when descriptor is unparseable", async () => {
    const result = {
      type: ClearSignContextType.SOLANA_TRANSACTION_CHECK as const,
      payload: { descriptor: "" },
      certificate: undefined,
    };

    await provideTransactionCheckContext(result as any, deps);

    expect(api.sendCommand).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining("descriptor could not be parsed"),
    );
  });
});
