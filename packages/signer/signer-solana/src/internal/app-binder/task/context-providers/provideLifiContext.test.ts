/* eslint-disable @typescript-eslint/no-explicit-any */
import { SolanaContextTypes } from "@ledgerhq/context-module";
import {
  CommandResultFactory,
  LoadCertificateCommand,
} from "@ledgerhq/device-management-kit";
import { beforeEach, describe, expect, it, type Mock, vi } from "vitest";

import { ProvideInstructionDescriptorCommand } from "@internal/app-binder/command/ProvideInstructionDescriptorCommand";

import { type ProvideContextDeps } from "./provideContextTypes";
import { provideLifiContext } from "./provideLifiContext";

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
};

const makeKey = (base58: string) => ({ toBase58: () => base58 });

const buildNormaliser = (message: any) =>
  ({ normaliseMessage: vi.fn(async () => message) }) as const;

const SIG = "f0cacc1a";

const swapCert = {
  payload: new Uint8Array([0x01, 0x02, 0x03]),
  keyUsageNumber: 13,
} as const;

describe("provideLifiContext", () => {
  let api: { sendCommand: Mock };
  const success = CommandResultFactory({ data: undefined });

  beforeEach(() => {
    vi.resetAllMocks();
    api = { sendCommand: vi.fn() };
  });

  function makeDeps(normaliser: any): ProvideContextDeps {
    return {
      api: api as any,
      logger: mockLogger as any,
      normaliser,
      transactionBytes: new Uint8Array([0xf0]),
    };
  }

  it("sends swap certificate then matched instruction descriptors", async () => {
    api.sendCommand
      .mockResolvedValueOnce(success) // swap cert
      .mockResolvedValue(success); // descriptors

    const message = {
      compiledInstructions: [
        { programIdIndex: 0, data: new Uint8Array([0x01]) },
        { programIdIndex: 1, data: new Uint8Array([0x02]) },
        { programIdIndex: 2, data: new Uint8Array([0x03]) },
      ],
      allKeys: [makeKey("A_PID"), makeKey("B_PID"), makeKey("C_PID")],
    };
    const normaliser = buildNormaliser(message);

    const result = {
      type: SolanaContextTypes.SOLANA_LIFI as const,
      payload: {
        descriptors: {
          "A_PID:1": { data: SIG, signature: SIG },
          "C_PID:3": { data: SIG, signature: SIG },
        },
        instructions: [
          { program_id: "A_PID", discriminator_hex: "1" },
          { program_id: "C_PID", discriminator_hex: "3" },
        ],
      },
      certificate: swapCert,
    };

    await provideLifiContext(result as any, makeDeps(normaliser));

    // 1 cert + 2 matched descriptors (B skipped)
    expect(api.sendCommand).toHaveBeenCalledTimes(3);

    expect(api.sendCommand.mock.calls[0]![0]!).toBeInstanceOf(
      LoadCertificateCommand,
    );
    expect(api.sendCommand.mock.calls[1]![0]!).toBeInstanceOf(
      ProvideInstructionDescriptorCommand,
    );
    expect(api.sendCommand.mock.calls[2]![0]!).toBeInstanceOf(
      ProvideInstructionDescriptorCommand,
    );
  });

  it("throws when swap certificate load fails", async () => {
    const errorResult = CommandResultFactory({
      error: { _tag: "Err", errorCode: 0x6a80, message: "bad" },
    });
    api.sendCommand.mockResolvedValueOnce(errorResult);

    const message = {
      compiledInstructions: [
        { programIdIndex: 0, data: new Uint8Array([0x01]) },
      ],
      allKeys: [makeKey("A")],
    };

    const result = {
      type: SolanaContextTypes.SOLANA_LIFI as const,
      payload: {
        descriptors: { "A:1": { data: SIG, signature: SIG } },
        instructions: [{ program_id: "A", discriminator_hex: "1" }],
      },
      certificate: swapCert,
    };

    await expect(
      provideLifiContext(result as any, makeDeps(buildNormaliser(message))),
    ).rejects.toThrow("Failed to send swapTemplateCertificate to device");
  });

  it("skips entirely when descriptors is falsy", async () => {
    const normaliser = buildNormaliser({});

    const result = {
      type: SolanaContextTypes.SOLANA_LIFI as const,
      payload: { descriptors: undefined as any, instructions: [] },
    };

    await provideLifiContext(result as any, makeDeps(normaliser));

    expect(api.sendCommand).not.toHaveBeenCalled();
    expect(normaliser.normaliseMessage).not.toHaveBeenCalled();
  });

  it("skips certificate but still processes instructions when certificate is absent", async () => {
    api.sendCommand.mockResolvedValue(success);

    const message = {
      compiledInstructions: [
        { programIdIndex: 0, data: new Uint8Array([0x01]) },
      ],
      allKeys: [makeKey("P1")],
    };

    const result = {
      type: SolanaContextTypes.SOLANA_LIFI as const,
      payload: {
        descriptors: { "P1:1": { data: SIG, signature: SIG } },
        instructions: [{ program_id: "P1", discriminator_hex: "1" }],
      },
      certificate: undefined,
    };

    await provideLifiContext(result as any, makeDeps(buildNormaliser(message)));

    // no cert, 1 descriptor
    expect(api.sendCommand).toHaveBeenCalledTimes(1);
    expect(api.sendCommand.mock.calls[0]![0]!).toBeInstanceOf(
      ProvideInstructionDescriptorCommand,
    );
  });

  it("sends no APDU when signature is empty", async () => {
    const message = {
      compiledInstructions: [
        { programIdIndex: 0, data: new Uint8Array([0x01]) },
      ],
      allKeys: [makeKey("PID")],
    };

    const result = {
      type: SolanaContextTypes.SOLANA_LIFI as const,
      payload: {
        descriptors: { "PID:": { data: SIG, signature: "" } },
        instructions: [{ program_id: "PID" }],
      },
    };

    await provideLifiContext(result as any, makeDeps(buildNormaliser(message)));

    expect(api.sendCommand).not.toHaveBeenCalled();
  });

  it("sends no APDU when programId is out of range", async () => {
    const message = {
      compiledInstructions: [{ programIdIndex: 5, data: new Uint8Array() }],
      allKeys: [makeKey("X")],
    };

    const result = {
      type: SolanaContextTypes.SOLANA_LIFI as const,
      payload: { descriptors: {}, instructions: [] },
    };

    await provideLifiContext(result as any, makeDeps(buildNormaliser(message)));

    expect(api.sendCommand).not.toHaveBeenCalled();
  });

  it("skips instruction when data is shorter than discriminator", async () => {
    const message = {
      compiledInstructions: [
        { programIdIndex: 0, data: new Uint8Array([0x2a]) },
      ],
      allKeys: [makeKey("SHORT")],
    };

    const result = {
      type: SolanaContextTypes.SOLANA_LIFI as const,
      payload: {
        descriptors: { "SHORT:2aade37a": { data: SIG, signature: SIG } },
        instructions: [{ program_id: "SHORT", discriminator_hex: "2aade37a" }],
      },
    };

    await provideLifiContext(result as any, makeDeps(buildNormaliser(message)));

    expect(api.sendCommand).not.toHaveBeenCalled();
  });

  it("skips instruction when discriminator does not match data prefix", async () => {
    const message = {
      compiledInstructions: [
        { programIdIndex: 0, data: new Uint8Array([0xff, 0xee, 0xdd, 0xcc]) },
      ],
      allKeys: [makeKey("MM")],
    };

    const result = {
      type: SolanaContextTypes.SOLANA_LIFI as const,
      payload: {
        descriptors: { "MM:aabbccdd": { data: SIG, signature: SIG } },
        instructions: [{ program_id: "MM", discriminator_hex: "aabbccdd" }],
      },
    };

    await provideLifiContext(result as any, makeDeps(buildNormaliser(message)));

    expect(api.sendCommand).not.toHaveBeenCalled();
  });

  it("selects the correct descriptor among multiple discriminator candidates", async () => {
    api.sendCommand.mockResolvedValue(success);

    const message = {
      compiledInstructions: [
        { programIdIndex: 0, data: new Uint8Array([0xbb, 0xcc, 0x00]) },
        { programIdIndex: 0, data: new Uint8Array([0xaa, 0xff, 0x00]) },
      ],
      allKeys: [makeKey("MULTI")],
    };

    const result = {
      type: SolanaContextTypes.SOLANA_LIFI as const,
      payload: {
        descriptors: {
          "MULTI:aaff": { data: "data_aa", signature: SIG },
          "MULTI:bbcc": { data: "data_bb", signature: SIG },
        },
        instructions: [
          { program_id: "MULTI", discriminator_hex: "aaff" },
          { program_id: "MULTI", discriminator_hex: "bbcc" },
        ],
      },
      certificate: swapCert,
    };

    await provideLifiContext(result as any, makeDeps(buildNormaliser(message)));

    // 1 cert + 2 descriptors
    expect(api.sendCommand).toHaveBeenCalledTimes(3);

    const c0 = api.sendCommand.mock.calls[1]![0]!;
    expect(c0).toBeInstanceOf(ProvideInstructionDescriptorCommand);
    expect(c0.args.dataHex).toBe("data_bb");

    const c1 = api.sendCommand.mock.calls[2]![0]!;
    expect(c1).toBeInstanceOf(ProvideInstructionDescriptorCommand);
    expect(c1.args.dataHex).toBe("data_aa");
  });

  it("returns undefined when discriminator matches but descriptor key is absent", async () => {
    const message = {
      compiledInstructions: [
        { programIdIndex: 0, data: new Uint8Array([0x01]) },
      ],
      allKeys: [makeKey("PROG")],
    };

    const result = {
      type: SolanaContextTypes.SOLANA_LIFI as const,
      payload: {
        descriptors: {},
        instructions: [{ program_id: "PROG", discriminator_hex: "1" }],
      },
    };

    await provideLifiContext(result as any, makeDeps(buildNormaliser(message)));

    expect(api.sendCommand).not.toHaveBeenCalled();
  });
});
