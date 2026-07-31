/* eslint-disable @typescript-eslint/no-explicit-any */
import { ClearSignContextType } from "@ledgerhq/context-module";
import {
  CommandResultFactory,
  LoadCertificateCommand,
} from "@ledgerhq/device-management-kit";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { ProvideTrustedNameCommand } from "@internal/app-binder/command/ProvideTrustedNameCommand";

import { type ProvideContextDeps } from "./provideContextTypes";
import { provideTrustedNameContext } from "./provideTrustedNameContext";

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
};
const cert = { payload: new Uint8Array([0xf0]), keyUsageNumber: 2 } as const;
const success = CommandResultFactory({ data: undefined });

describe("provideTrustedNameContext", () => {
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

  it("streams TRUSTED_NAME (0x29) as raw TLV (no length prefix)", async () => {
    api.sendCommand.mockResolvedValue(success);

    await provideTrustedNameContext(
      {
        type: ClearSignContextType.SOLANA_TRUSTED_NAME as const,
        payload: new Uint8Array([0xaa, 0xbb]),
        certificate: cert,
      } as any,
      deps,
    );

    expect(api.sendCommand.mock.calls[0]![0]).toBeInstanceOf(
      LoadCertificateCommand,
    );
    const cmd = api.sendCommand.mock.calls[1]![0];
    expect(cmd).toBeInstanceOf(ProvideTrustedNameCommand);
    expect(cmd.args.payload).toStrictEqual(new Uint8Array([0xaa, 0xbb]));
  });

  it("does nothing for an empty payload", async () => {
    await provideTrustedNameContext(
      {
        type: ClearSignContextType.SOLANA_TRUSTED_NAME as const,
        payload: new Uint8Array([]),
        certificate: cert,
      } as any,
      deps,
    );
    expect(api.sendCommand).not.toHaveBeenCalled();
  });
});
