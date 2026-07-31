/* eslint-disable @typescript-eslint/no-explicit-any */
import { ClearSignContextType } from "@ledgerhq/context-module";
import {
  CommandResultFactory,
  LoadCertificateCommand,
} from "@ledgerhq/device-management-kit";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { ProvideTLVDescriptorCommand } from "@internal/app-binder/command/ProvideTLVDescriptorCommand";

import { provideBasicTrustedNameContext } from "./provideBasicTrustedNameContext";
import { type ProvideContextDeps } from "./provideContextTypes";

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
};
const cert = { payload: new Uint8Array([0xf0]), keyUsageNumber: 2 } as const;
const success = CommandResultFactory({ data: undefined });

describe("provideBasicTrustedNameContext", () => {
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

  it("sends TRUSTED_NAME (0x21) as raw bytes — no 2-byte length prefix", async () => {
    api.sendCommand.mockResolvedValue(success);

    await provideBasicTrustedNameContext(
      {
        type: ClearSignContextType.SOLANA_BASIC_TRUSTED_NAME as const,
        payload: new Uint8Array([0xaa, 0xbb]),
        certificate: cert,
      } as any,
      deps,
    );

    expect(api.sendCommand.mock.calls[0]![0]).toBeInstanceOf(
      LoadCertificateCommand,
    );
    const cmd = api.sendCommand.mock.calls[1]![0];
    expect(cmd).toBeInstanceOf(ProvideTLVDescriptorCommand);
    // Raw bytes — no [0x00, 0x02] length prefix prepended
    expect(cmd.args.payload).toStrictEqual(new Uint8Array([0xaa, 0xbb]));
  });

  it("does nothing for an empty payload", async () => {
    await provideBasicTrustedNameContext(
      {
        type: ClearSignContextType.SOLANA_BASIC_TRUSTED_NAME as const,
        payload: new Uint8Array([]),
        certificate: cert,
      } as any,
      deps,
    );
    expect(api.sendCommand).not.toHaveBeenCalled();
  });

  it("skips certificate load when certificate is absent", async () => {
    api.sendCommand.mockResolvedValue(success);

    await provideBasicTrustedNameContext(
      {
        type: ClearSignContextType.SOLANA_BASIC_TRUSTED_NAME as const,
        payload: new Uint8Array([0xcc]),
        certificate: undefined,
      } as any,
      deps,
    );

    expect(api.sendCommand).toHaveBeenCalledTimes(1);
    expect(api.sendCommand.mock.calls[0]![0]).toBeInstanceOf(
      ProvideTLVDescriptorCommand,
    );
  });
});
