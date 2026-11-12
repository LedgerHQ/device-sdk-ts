/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ClearSignContextType,
  type SolanaGatedSigningContextSuccess,
} from "@ledgerhq/context-module";
import {
  CommandResultFactory,
  isSuccessCommandResult,
  LoadCertificateCommand,
} from "@ledgerhq/device-management-kit";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { ProvideGatedSigningCommand } from "@internal/app-binder/command/ProvideGatedSigningCommand";

import { type ProvideContextDeps } from "./provideContextTypes";
import { provideGatedSigningContext } from "./provideGatedSigningContext";

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
};
const cert = { payload: new Uint8Array([0xf0]), keyUsageNumber: 13 } as const;
const success = CommandResultFactory({ data: undefined });
const failure = CommandResultFactory({
  error: { _tag: "E", errorCode: 0x6a80, message: "no" } as any,
});

const context = (payload: string): SolanaGatedSigningContextSuccess => ({
  type: ClearSignContextType.SOLANA_GATED_SIGNING,
  payload,
  certificate: cert,
});

describe("provideGatedSigningContext", () => {
  let api: { sendCommand: Mock };
  let deps: ProvideContextDeps;

  beforeEach(() => {
    vi.resetAllMocks();
    api = { sendCommand: vi.fn() };
    deps = {
      api: api as any,
      logger: mockLogger as any,
      normaliser: {} as any,
      transactionBytes: new Uint8Array(),
    };
  });

  it("loads the certificate then streams the descriptor (0x2A)", async () => {
    api.sendCommand.mockResolvedValue(success);

    const result = await provideGatedSigningContext(context("aabb"), deps);

    expect(isSuccessCommandResult(result)).toBe(true);
    expect(api.sendCommand.mock.calls[0]![0]).toBeInstanceOf(
      LoadCertificateCommand,
    );
    const cmd = api.sendCommand.mock.calls[1]![0];
    expect(cmd).toBeInstanceOf(ProvideGatedSigningCommand);
    expect(cmd.args.payload).toStrictEqual(new Uint8Array([0xaa, 0xbb]));
  });

  it("streams a long descriptor in chunks", async () => {
    api.sendCommand.mockResolvedValue(success);

    await provideGatedSigningContext(
      { ...context("ab".repeat(300)), certificate: undefined },
      deps,
    );

    const chunks = api.sendCommand.mock.calls.map(([cmd]) => cmd);
    expect(chunks).toHaveLength(2);
    expect(chunks[0].args).toMatchObject({ isFirstChunk: true, hasMore: true });
    expect(chunks[1].args).toMatchObject({
      isFirstChunk: false,
      hasMore: false,
    });
  });

  it("fails without sending anything when the descriptor is not hex", async () => {
    const result = await provideGatedSigningContext(context("zz"), deps);

    expect(isSuccessCommandResult(result)).toBe(false);
    expect(api.sendCommand).not.toHaveBeenCalled();
  });

  it("stops when the certificate is rejected", async () => {
    api.sendCommand.mockResolvedValueOnce(failure);

    const result = await provideGatedSigningContext(context("aabb"), deps);

    expect(isSuccessCommandResult(result)).toBe(false);
    expect(api.sendCommand).toHaveBeenCalledTimes(1);
  });

  it("returns the device error when the descriptor is rejected", async () => {
    api.sendCommand
      .mockResolvedValueOnce(success)
      .mockResolvedValueOnce(failure);

    const result = await provideGatedSigningContext(context("aabb"), deps);

    expect(isSuccessCommandResult(result)).toBe(false);
  });
});
