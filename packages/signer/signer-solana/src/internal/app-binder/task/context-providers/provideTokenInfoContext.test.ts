/* eslint-disable @typescript-eslint/no-explicit-any */
import { ClearSignContextType } from "@ledgerhq/context-module";
import {
  CommandResultFactory,
  LoadCertificateCommand,
} from "@ledgerhq/device-management-kit";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { ProvideTLVTransactionInstructionDescriptorCommand } from "@internal/app-binder/command/ProvideTLVTransactionInstructionDescriptorCommand";

import { type ProvideContextDeps } from "./provideContextTypes";
import { provideTokenInfoContext } from "./provideTokenInfoContext";

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
};
const cert = { payload: new Uint8Array([0xf0]), keyUsageNumber: 2 } as const;
const success = CommandResultFactory({ data: undefined });

describe("provideTokenInfoContext", () => {
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

  it("loads the certificate then sends TOKEN_INFO via dataHex/signatureHex", async () => {
    api.sendCommand.mockResolvedValue(success);

    await provideTokenInfoContext(
      {
        type: ClearSignContextType.SOLANA_TOKEN_INFO as const,
        payload: { mint: "M", descriptor: { data: "aabb", signature: "cc" } },
        certificate: cert,
      } as any,
      deps,
    );

    expect(api.sendCommand.mock.calls[0]![0]).toBeInstanceOf(
      LoadCertificateCommand,
    );
    const cmd = api.sendCommand.mock.calls[1]![0];
    expect(cmd).toBeInstanceOf(
      ProvideTLVTransactionInstructionDescriptorCommand,
    );
    expect(cmd.args.dataHex).toBe("aabb");
    expect(cmd.args.signatureHex).toBe("cc");
  });

  it("throws when the device rejects the descriptor", async () => {
    api.sendCommand.mockResolvedValueOnce(success).mockResolvedValueOnce(
      CommandResultFactory({
        error: { _tag: "E", errorCode: 0x6a80, message: "no" } as any,
      }),
    );

    await expect(
      provideTokenInfoContext(
        {
          type: ClearSignContextType.SOLANA_TOKEN_INFO as const,
          payload: { mint: "M", descriptor: { data: "aabb", signature: "cc" } },
          certificate: cert,
        } as any,
        deps,
      ),
    ).rejects.toThrow("device rejected TOKEN_INFO");
  });
});
