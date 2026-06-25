/* eslint-disable @typescript-eslint/no-explicit-any */
import { ClearSignContextType } from "@ledgerhq/context-module";
import {
  CommandResultFactory,
  LoadCertificateCommand,
} from "@ledgerhq/device-management-kit";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { ProvideInstructionInfoCommand } from "@internal/app-binder/command/ProvideInstructionInfoCommand";
import { ProvideInstructionSubstructureCommand } from "@internal/app-binder/command/ProvideInstructionSubstructureCommand";

import { type ProvideContextDeps } from "./provideContextTypes";
import { provideInstructionInfoContext } from "./provideInstructionInfoContext";

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
};

const cert = { payload: new Uint8Array([0xf0]), keyUsageNumber: 11 } as const;
const success = CommandResultFactory({ data: undefined });

function makeResult() {
  return {
    type: ClearSignContextType.SOLANA_INSTRUCTION_INFO as const,
    payload: {
      programId: "P",
      discriminator: "0102",
      instructionInfo: { data: "aabb", signature: "abcd" },
      substructures: [
        { kind: 0x00, data: "ccdd" },
        { kind: 0x01, data: "ee" },
      ],
      enumVariants: [],
    },
    certificate: cert,
  };
}

describe("provideInstructionInfoContext", () => {
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

  it("loads the certificate, then streams INSTRUCTION_INFO and substructures (framed, in order)", async () => {
    api.sendCommand.mockResolvedValue(success);

    await provideInstructionInfoContext(makeResult() as any, deps);

    expect(api.sendCommand).toHaveBeenCalledTimes(4);

    expect(api.sendCommand.mock.calls[0]![0]).toBeInstanceOf(
      LoadCertificateCommand,
    );

    const info = api.sendCommand.mock.calls[1]![0];
    expect(info).toBeInstanceOf(ProvideInstructionInfoCommand);
    // data (aabb) + trailing SIGNATURE (0x15) TLV over the picked signature
    // (abcd), behind the 2-byte length prefix.
    expect(info.args.payload).toStrictEqual(
      new Uint8Array([0x00, 0x06, 0xaa, 0xbb, 0x15, 0x02, 0xab, 0xcd]),
    );

    const sub0 = api.sendCommand.mock.calls[2]![0];
    expect(sub0).toBeInstanceOf(ProvideInstructionSubstructureCommand);
    expect(sub0.args.payload).toStrictEqual(
      new Uint8Array([0x00, 0x03, 0x00, 0xcc, 0xdd]),
    );

    const sub1 = api.sendCommand.mock.calls[3]![0];
    expect(sub1.args.payload).toStrictEqual(
      new Uint8Array([0x00, 0x02, 0x01, 0xee]),
    );
  });

  it("throws when the device rejects the INSTRUCTION_INFO", async () => {
    api.sendCommand
      .mockResolvedValueOnce(success) // cert
      .mockResolvedValueOnce(
        CommandResultFactory({
          error: { _tag: "E", errorCode: 0x6a80, message: "no" } as any,
        }),
      );

    await expect(
      provideInstructionInfoContext(makeResult() as any, deps),
    ).rejects.toThrow("device rejected INSTRUCTION_INFO");
  });

  it("throws when the INSTRUCTION_INFO signature is missing", async () => {
    api.sendCommand.mockResolvedValue(success);
    const result = makeResult();
    result.payload.instructionInfo.signature = "";

    await expect(
      provideInstructionInfoContext(result as any, deps),
    ).rejects.toThrow("missing INSTRUCTION_INFO signature");
    // never reaches the device with the descriptor (only the cert load, if any)
    expect(api.sendCommand).not.toHaveBeenCalledWith(
      expect.any(ProvideInstructionInfoCommand),
    );
  });
});
