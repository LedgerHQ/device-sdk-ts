/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  CommandResultFactory,
  isSuccessCommandResult,
  LoadCertificateCommand,
} from "@ledgerhq/device-management-kit";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { loadCertificate, loadCertificateIfPresent } from "./loadCertificate";

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
};

const cert = { payload: new Uint8Array([0xf0]), keyUsageNumber: 11 } as const;
const success = CommandResultFactory({ data: undefined });

describe("loadCertificate", () => {
  let api: { sendCommand: Mock };

  beforeEach(() => {
    vi.resetAllMocks();
    api = { sendCommand: vi.fn() };
  });

  it("sends LOAD_CERTIFICATE and returns success", async () => {
    api.sendCommand.mockResolvedValue(success);

    const result = await loadCertificate(
      api as any,
      cert,
      mockLogger as any,
      "testCaller",
    );

    expect(isSuccessCommandResult(result)).toBe(true);
    const cmd = api.sendCommand.mock.calls[0]![0];
    expect(cmd).toBeInstanceOf(LoadCertificateCommand);
    expect(cmd.args.certificate).toStrictEqual(cert.payload);
    expect(cmd.args.keyUsage).toBe(cert.keyUsageNumber);
  });

  it("returns a failed CommandResult and logs when the device rejects LOAD_CERTIFICATE", async () => {
    api.sendCommand.mockResolvedValue(
      CommandResultFactory({
        error: { _tag: "E", errorCode: 0x6a80, message: "no" } as any,
      }),
    );

    const result = await loadCertificate(
      api as any,
      cert,
      mockLogger as any,
      "testCaller",
    );

    expect(isSuccessCommandResult(result)).toBe(false);
    expect(mockLogger.error).toHaveBeenCalledWith(
      "[loadCertificate] device rejected LOAD_CERTIFICATE",
      {
        data: {
          caller: "testCaller",
          error: expect.anything(),
          keyUsage: cert.keyUsageNumber,
        },
      },
    );
  });
});

describe("loadCertificateIfPresent", () => {
  let api: { sendCommand: Mock };

  beforeEach(() => {
    vi.resetAllMocks();
    api = { sendCommand: vi.fn() };
  });

  it("is a no-op success when no certificate is provided", async () => {
    const result = await loadCertificateIfPresent(
      api as any,
      undefined,
      mockLogger as any,
      "testCaller",
    );

    expect(isSuccessCommandResult(result)).toBe(true);
    expect(api.sendCommand).not.toHaveBeenCalled();
  });

  it("loads the certificate when present", async () => {
    api.sendCommand.mockResolvedValue(success);

    const result = await loadCertificateIfPresent(
      api as any,
      cert,
      mockLogger as any,
      "testCaller",
    );

    expect(isSuccessCommandResult(result)).toBe(true);
    expect(api.sendCommand.mock.calls[0]![0]).toBeInstanceOf(
      LoadCertificateCommand,
    );
  });

  it("propagates a failed CommandResult when the device rejects the certificate", async () => {
    api.sendCommand.mockResolvedValue(
      CommandResultFactory({
        error: { _tag: "E", errorCode: 0x6a80, message: "no" } as any,
      }),
    );

    const result = await loadCertificateIfPresent(
      api as any,
      cert,
      mockLogger as any,
      "testCaller",
    );

    expect(isSuccessCommandResult(result)).toBe(false);
  });
});
