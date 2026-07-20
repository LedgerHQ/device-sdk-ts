/* eslint-disable @typescript-eslint/no-explicit-any */
import { ClearSignContextType } from "@ledgerhq/context-module";
import {
  CommandResultFactory,
  LoadCertificateCommand,
} from "@ledgerhq/device-management-kit";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { ProvideAltResolutionCommand } from "@internal/app-binder/command/ProvideAltResolutionCommand";

import { provideAltResolutionContext } from "./provideAltResolutionContext";
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

describe("provideAltResolutionContext", () => {
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

  it("loads the certificate then streams the framed ALT_RESOLUTION (0x28)", async () => {
    api.sendCommand.mockResolvedValue(success);

    await provideAltResolutionContext(
      {
        type: ClearSignContextType.SOLANA_ALT_RESOLUTION as const,
        payload: { descriptor: new Uint8Array([0xaa, 0xbb]) },
        certificate: cert,
      } as any,
      deps,
    );

    expect(api.sendCommand.mock.calls[0]![0]).toBeInstanceOf(
      LoadCertificateCommand,
    );
    const cmd = api.sendCommand.mock.calls[1]![0];
    expect(cmd).toBeInstanceOf(ProvideAltResolutionCommand);
    expect(cmd.args.payload).toStrictEqual(new Uint8Array([0xaa, 0xbb]));
  });

  it("throws when the device rejects the descriptor", async () => {
    api.sendCommand.mockResolvedValueOnce(success).mockResolvedValueOnce(
      CommandResultFactory({
        error: { _tag: "E", errorCode: 0x6a80, message: "no" } as any,
      }),
    );

    await expect(
      provideAltResolutionContext(
        {
          type: ClearSignContextType.SOLANA_ALT_RESOLUTION as const,
          payload: { descriptor: new Uint8Array([0xaa, 0xbb]) },
          certificate: cert,
        } as any,
        deps,
      ),
    ).rejects.toThrow("device rejected ALT_RESOLUTION");
  });
});
