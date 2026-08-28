/* eslint-disable @typescript-eslint/no-explicit-any */
import { ClearSignContextType } from "@ledgerhq/context-module";
import {
  CommandResultFactory,
  isSuccessCommandResult,
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
    // (abcd), no length prefix.
    expect(info.args.payload).toStrictEqual(
      new Uint8Array([0xaa, 0xbb, 0x15, 0x02, 0xab, 0xcd]),
    );

    const sub0 = api.sendCommand.mock.calls[2]![0];
    expect(sub0).toBeInstanceOf(ProvideInstructionSubstructureCommand);
    // substructure type byte (0x00) then TLV (ccdd), no length prefix.
    expect(sub0.args.payload).toStrictEqual(new Uint8Array([0x00, 0xcc, 0xdd]));

    const sub1 = api.sendCommand.mock.calls[3]![0];
    expect(sub1.args.payload).toStrictEqual(new Uint8Array([0x01, 0xee]));
  });

  it("returns success without sending any command when payload is absent", async () => {
    const result = makeResult();
    (result as any).payload = undefined;

    const out = await provideInstructionInfoContext(result as any, deps);
    expect(isSuccessCommandResult(out)).toBe(true);
    expect(api.sendCommand).not.toHaveBeenCalled();
  });

  it("returns a failed CommandResult when the certificate is rejected", async () => {
    api.sendCommand.mockResolvedValueOnce(
      CommandResultFactory({
        error: { _tag: "E", errorCode: 0x6a80, message: "no" } as any,
      }),
    );

    const result = await provideInstructionInfoContext(
      makeResult() as any,
      deps,
    );

    expect(isSuccessCommandResult(result)).toBe(false);
    expect(api.sendCommand).toHaveBeenCalledTimes(1);
  });

  it("returns a failed CommandResult when the device rejects INSTRUCTION_INFO", async () => {
    api.sendCommand
      .mockResolvedValueOnce(success) // cert
      .mockResolvedValueOnce(
        CommandResultFactory({
          error: { _tag: "E", errorCode: 0x6a80, message: "no" } as any,
        }),
      );

    const result = await provideInstructionInfoContext(
      makeResult() as any,
      deps,
    );
    expect(isSuccessCommandResult(result)).toBe(false);
  });

  it("logs an error and returns a failed CommandResult when the INSTRUCTION_INFO data is malformed", async () => {
    api.sendCommand.mockResolvedValue(success);
    const result = makeResult();
    result.payload.instructionInfo.data = "zz";

    const out = await provideInstructionInfoContext(result as any, deps);
    expect(isSuccessCommandResult(out)).toBe(false);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining("malformed INSTRUCTION_INFO"),
    );
    expect(api.sendCommand).not.toHaveBeenCalledWith(
      expect.any(ProvideInstructionInfoCommand),
    );
  });

  it("returns a failed CommandResult when the device rejects a substructure", async () => {
    api.sendCommand
      .mockResolvedValueOnce(success) // cert
      .mockResolvedValueOnce(success) // INSTRUCTION_INFO
      .mockResolvedValueOnce(
        CommandResultFactory({
          error: { _tag: "E", errorCode: 0x6a80, message: "no" } as any,
        }),
      );

    const result = await provideInstructionInfoContext(
      makeResult() as any,
      deps,
    );
    expect(isSuccessCommandResult(result)).toBe(false);
  });

  it("returns a failed CommandResult when a substructure is malformed", async () => {
    api.sendCommand.mockResolvedValue(success);
    const result = makeResult();
    result.payload.substructures[0]!.data = "zz";

    const out = await provideInstructionInfoContext(result as any, deps);
    expect(isSuccessCommandResult(out)).toBe(false);
    // INSTRUCTION_INFO was already sent before the malformed substructure was
    // hit, and the second (valid) substructure must not be sent either.
    expect(api.sendCommand).toHaveBeenCalledTimes(2);
  });

  it("logs an error and returns a failed CommandResult when the INSTRUCTION_INFO signature is missing", async () => {
    api.sendCommand.mockResolvedValue(success);
    const result = makeResult();
    result.payload.instructionInfo.signature = "";

    const out = await provideInstructionInfoContext(result as any, deps);
    expect(isSuccessCommandResult(out)).toBe(false);
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.stringContaining("missing INSTRUCTION_INFO signature"),
    );
    expect(api.sendCommand).not.toHaveBeenCalledWith(
      expect.any(ProvideInstructionInfoCommand),
    );
  });
});
