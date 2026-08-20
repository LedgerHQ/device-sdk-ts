/* eslint-disable @typescript-eslint/no-explicit-any */
import { ClearSignContextType } from "@ledgerhq/context-module";
import {
  CommandResultFactory,
  isSuccessCommandResult,
  LoadCertificateCommand,
} from "@ledgerhq/device-management-kit";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { ProvideEnumVariantCommand } from "@internal/app-binder/command/ProvideEnumVariantCommand";

import { type ProvideContextDeps } from "./provideContextTypes";
import { provideEnumVariantContext } from "./provideEnumVariantContext";

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
};
const cert = { payload: new Uint8Array([0xf0]), keyUsageNumber: 2 } as const;
const success = CommandResultFactory({ data: undefined });

describe("provideEnumVariantContext", () => {
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

  it("loads the certificate then streams the framed ENUM_VARIANT (0x26)", async () => {
    api.sendCommand.mockResolvedValue(success);

    await provideEnumVariantContext(
      {
        type: ClearSignContextType.SOLANA_ENUM_VARIANT as const,
        payload: {
          programId: "P",
          enumId: "swap",
          variantIndex: 46,
          descriptor: { data: "aabb", signature: "abcd" },
        },
        certificate: cert,
      } as any,
      deps,
    );

    expect(api.sendCommand.mock.calls[0]![0]).toBeInstanceOf(
      LoadCertificateCommand,
    );
    const cmd = api.sendCommand.mock.calls[1]![0];
    expect(cmd).toBeInstanceOf(ProvideEnumVariantCommand);
    // data (aabb) + trailing SIGNATURE (0x15) TLV over the picked signature
    // (abcd), no length prefix.
    expect(cmd.args.payload).toStrictEqual(
      new Uint8Array([0xaa, 0xbb, 0x15, 0x02, 0xab, 0xcd]),
    );
  });

  it("returns success without sending any command when payload is absent", async () => {
    const result = await provideEnumVariantContext(
      {
        type: ClearSignContextType.SOLANA_ENUM_VARIANT as const,
        payload: undefined,
        certificate: cert,
      } as any,
      deps,
    );

    expect(isSuccessCommandResult(result)).toBe(true);
    expect(api.sendCommand).not.toHaveBeenCalled();
  });

  it("returns a failed CommandResult when the certificate is rejected", async () => {
    api.sendCommand.mockResolvedValueOnce(
      CommandResultFactory({
        error: { _tag: "E", errorCode: 0x6a80, message: "no" } as any,
      }),
    );

    const result = await provideEnumVariantContext(
      {
        type: ClearSignContextType.SOLANA_ENUM_VARIANT as const,
        payload: {
          programId: "P",
          enumId: "swap",
          variantIndex: 46,
          descriptor: { data: "aabb", signature: "abcd" },
        },
        certificate: cert,
      } as any,
      deps,
    );

    expect(isSuccessCommandResult(result)).toBe(false);
    expect(api.sendCommand).toHaveBeenCalledTimes(1);
  });

  it("logs a warning and returns success when the ENUM_VARIANT descriptor data is malformed", async () => {
    api.sendCommand.mockResolvedValue(success);

    const result = await provideEnumVariantContext(
      {
        type: ClearSignContextType.SOLANA_ENUM_VARIANT as const,
        payload: {
          programId: "P",
          enumId: "swap",
          variantIndex: 46,
          descriptor: { data: "zz", signature: "abcd" },
        },
        certificate: cert,
      } as any,
      deps,
    );

    expect(isSuccessCommandResult(result)).toBe(true);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining("malformed ENUM_VARIANT"),
    );
    expect(api.sendCommand).not.toHaveBeenCalledWith(
      expect.any(ProvideEnumVariantCommand),
    );
  });

  it("returns a failed CommandResult when the device rejects the ENUM_VARIANT", async () => {
    api.sendCommand.mockResolvedValueOnce(success).mockResolvedValueOnce(
      CommandResultFactory({
        error: { _tag: "E", errorCode: 0x6a80, message: "no" } as any,
      }),
    );

    const result = await provideEnumVariantContext(
      {
        type: ClearSignContextType.SOLANA_ENUM_VARIANT as const,
        payload: {
          programId: "P",
          enumId: "swap",
          variantIndex: 46,
          descriptor: { data: "aabb", signature: "abcd" },
        },
        certificate: cert,
      } as any,
      deps,
    );
    expect(isSuccessCommandResult(result)).toBe(false);
  });

  it("logs a warning and returns success when the ENUM_VARIANT signature is missing", async () => {
    api.sendCommand.mockResolvedValue(success);

    const result = await provideEnumVariantContext(
      {
        type: ClearSignContextType.SOLANA_ENUM_VARIANT as const,
        payload: {
          programId: "P",
          enumId: "swap",
          variantIndex: 46,
          descriptor: { data: "aabb", signature: "" },
        },
        certificate: cert,
      } as any,
      deps,
    );
    expect(isSuccessCommandResult(result)).toBe(true);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining("missing ENUM_VARIANT signature"),
    );
    expect(api.sendCommand).not.toHaveBeenCalledWith(
      expect.any(ProvideEnumVariantCommand),
    );
  });
});
