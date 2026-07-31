/* eslint-disable @typescript-eslint/no-explicit-any */
import { ClearSignContextType } from "@ledgerhq/context-module";
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
      type: ClearSignContextType.SOLANA_LIFI as const,
      payload: {
        descriptors: {
          "A_PID:1": [{ data: SIG, signature: SIG }],
          "C_PID:3": [{ data: SIG, signature: SIG }],
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

    expect(api.sendCommand.mock.calls[0]![0]).toBeInstanceOf(
      LoadCertificateCommand,
    );
    expect(api.sendCommand.mock.calls[1]![0]).toBeInstanceOf(
      ProvideInstructionDescriptorCommand,
    );
    expect(api.sendCommand.mock.calls[2]![0]).toBeInstanceOf(
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
      type: ClearSignContextType.SOLANA_LIFI as const,
      payload: {
        descriptors: { "A:1": [{ data: SIG, signature: SIG }] },
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
      type: ClearSignContextType.SOLANA_LIFI as const,
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
      type: ClearSignContextType.SOLANA_LIFI as const,
      payload: {
        descriptors: { "P1:1": [{ data: SIG, signature: SIG }] },
        instructions: [{ program_id: "P1", discriminator_hex: "1" }],
      },
      certificate: undefined,
    };

    await provideLifiContext(result as any, makeDeps(buildNormaliser(message)));

    // no cert, 1 descriptor
    expect(api.sendCommand).toHaveBeenCalledTimes(1);
    expect(api.sendCommand.mock.calls[0]![0]).toBeInstanceOf(
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
      type: ClearSignContextType.SOLANA_LIFI as const,
      payload: {
        descriptors: { "PID:": [{ data: SIG, signature: "" }] },
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
      type: ClearSignContextType.SOLANA_LIFI as const,
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
      type: ClearSignContextType.SOLANA_LIFI as const,
      payload: {
        descriptors: { "SHORT:2aade37a": [{ data: SIG, signature: SIG }] },
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
      type: ClearSignContextType.SOLANA_LIFI as const,
      payload: {
        descriptors: { "MM:aabbccdd": [{ data: SIG, signature: SIG }] },
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
      type: ClearSignContextType.SOLANA_LIFI as const,
      payload: {
        descriptors: {
          "MULTI:aaff": [{ data: "data_aa", signature: SIG }],
          "MULTI:bbcc": [{ data: "data_bb", signature: SIG }],
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
      type: ClearSignContextType.SOLANA_LIFI as const,
      payload: {
        descriptors: {},
        instructions: [{ program_id: "PROG", discriminator_hex: "1" }],
      },
    };

    await provideLifiContext(result as any, makeDeps(buildNormaliser(message)));

    expect(api.sendCommand).not.toHaveBeenCalled();
  });

  it("selects descriptor by has_basis_point: normal then fee in template order", async () => {
    // Models the LiFi CAL fix: two native SOL transfer instructions share
    // discriminator 02. has_basis_point on the meta entry drives which
    // descriptor is sent for each occurrence.
    api.sendCommand.mockResolvedValue(success);

    const message = {
      compiledInstructions: [
        { programIdIndex: 0, data: new Uint8Array([0x02, 0x00, 0x00, 0x00]) }, // transfer
        { programIdIndex: 0, data: new Uint8Array([0x02, 0x00, 0x00, 0x00]) }, // fee
      ],
      allKeys: [makeKey("11111111111111111111111111111111")],
    };

    const result = {
      type: ClearSignContextType.SOLANA_LIFI as const,
      payload: {
        descriptors: {
          "11111111111111111111111111111111:02": [
            {
              data: "transfer_data",
              signature: "transfer_sig",
              has_basis_point: false,
            },
            { data: "fee_data", signature: "fee_sig", has_basis_point: true },
          ],
        },
        instructions: [
          {
            program_id: "11111111111111111111111111111111",
            discriminator_hex: "02",
            has_basis_point: false,
          },
          {
            program_id: "11111111111111111111111111111111",
            discriminator_hex: "02",
            has_basis_point: true,
          },
        ],
      },
      certificate: undefined,
    };

    await provideLifiContext(result as any, makeDeps(buildNormaliser(message)));

    expect(api.sendCommand).toHaveBeenCalledTimes(2);
    expect(api.sendCommand.mock.calls[0]![0].args.dataHex).toBe(
      "transfer_data",
    );
    expect(api.sendCommand.mock.calls[1]![0].args.dataHex).toBe("fee_data");
  });

  it("selects descriptor by has_basis_point even when descriptor queue order is reversed", async () => {
    // Proves that has_basis_point selection is independent of descriptor queue
    // order. The descriptors array has fee first, normal second — opposite of
    // the instructions/meta order. Pure FIFO would send fee_data for the normal
    // transfer instruction; has_basis_point matching corrects this.
    api.sendCommand.mockResolvedValue(success);

    const message = {
      compiledInstructions: [
        { programIdIndex: 0, data: new Uint8Array([0x02, 0x00, 0x00, 0x00]) }, // normal transfer
        { programIdIndex: 0, data: new Uint8Array([0x02, 0x00, 0x00, 0x00]) }, // fee transfer
      ],
      allKeys: [makeKey("11111111111111111111111111111111")],
    };

    const result = {
      type: ClearSignContextType.SOLANA_LIFI as const,
      payload: {
        // Descriptor queue is intentionally reversed vs meta order
        descriptors: {
          "11111111111111111111111111111111:02": [
            { data: "fee_data", signature: "fee_sig", has_basis_point: true },
            {
              data: "transfer_data",
              signature: "transfer_sig",
              has_basis_point: false,
            },
          ],
        },
        // Meta/template says: normal first, fee second
        instructions: [
          {
            program_id: "11111111111111111111111111111111",
            discriminator_hex: "02",
            has_basis_point: false,
          },
          {
            program_id: "11111111111111111111111111111111",
            discriminator_hex: "02",
            has_basis_point: true,
          },
        ],
      },
      certificate: undefined,
    };

    await provideLifiContext(result as any, makeDeps(buildNormaliser(message)));

    expect(api.sendCommand).toHaveBeenCalledTimes(2);
    // First: meta says has_basis_point=false → transfer_data (not fee_data despite being first in queue)
    expect(api.sendCommand.mock.calls[0]![0].args.dataHex).toBe(
      "transfer_data",
    );
    // Second: meta says has_basis_point=true → fee_data
    expect(api.sendCommand.mock.calls[1]![0].args.dataHex).toBe("fee_data");
  });

  it("sends only one descriptor per instruction even when queue has extras", async () => {
    // A single compiled instruction with two queued descriptors should only
    // consume the first (FIFO) — the second stays in the queue.
    api.sendCommand.mockResolvedValue(success);

    const message = {
      compiledInstructions: [
        { programIdIndex: 0, data: new Uint8Array([0x02, 0x00, 0x00, 0x00]) },
      ],
      allKeys: [makeKey("11111111111111111111111111111111")],
    };

    const result = {
      type: ClearSignContextType.SOLANA_LIFI as const,
      payload: {
        descriptors: {
          "11111111111111111111111111111111:02": [
            { data: "transfer_data", signature: "transfer_sig" },
            { data: "fee_data", signature: "fee_sig" },
          ],
        },
        instructions: [
          {
            program_id: "11111111111111111111111111111111",
            discriminator_hex: "02",
          },
          {
            program_id: "11111111111111111111111111111111",
            discriminator_hex: "02",
          },
        ],
      },
      certificate: undefined,
    };

    await provideLifiContext(result as any, makeDeps(buildNormaliser(message)));

    // Only one instruction compiled → only one descriptor consumed
    expect(api.sendCommand).toHaveBeenCalledTimes(1);
    expect(api.sendCommand.mock.calls[0]![0].args.dataHex).toBe(
      "transfer_data",
    );
  });

  it("falls back to FIFO when has_basis_point on meta has no matching descriptor", async () => {
    // Models the CAL anomaly seen in production: both descriptors for the
    // System Transfer key carry has_basis_point=true (no normal descriptor).
    // The first compiled instruction's meta says has_basis_point=false, which
    // matches nothing — popMatchingDescriptor falls back to FIFO (first entry).
    api.sendCommand.mockResolvedValue(success);

    const message = {
      compiledInstructions: [
        { programIdIndex: 0, data: new Uint8Array([0x02, 0x00, 0x00, 0x00]) },
        { programIdIndex: 0, data: new Uint8Array([0x02, 0x00, 0x00, 0x00]) },
      ],
      allKeys: [makeKey("11111111111111111111111111111111")],
    };

    const result = {
      type: ClearSignContextType.SOLANA_LIFI as const,
      payload: {
        // Both descriptors are fee descriptors (no normal descriptor present)
        descriptors: {
          "11111111111111111111111111111111:02": [
            { data: "fee_data_1", signature: "sig1", has_basis_point: true },
            { data: "fee_data_2", signature: "sig2", has_basis_point: true },
          ],
        },
        instructions: [
          {
            program_id: "11111111111111111111111111111111",
            discriminator_hex: "02",
            has_basis_point: false, // no match in pool → FIFO fallback
          },
          {
            program_id: "11111111111111111111111111111111",
            discriminator_hex: "02",
            has_basis_point: true,
          },
        ],
      },
      certificate: undefined,
    };

    await provideLifiContext(result as any, makeDeps(buildNormaliser(message)));

    expect(api.sendCommand).toHaveBeenCalledTimes(2);
    // First: no has_basis_point=false descriptor → FIFO fallback → shifts fee_data_1
    expect(api.sendCommand.mock.calls[0]![0].args.dataHex).toBe("fee_data_1");
    // Second: queue now has only fee_data_2 (length=1) → single-descriptor reuse path
    expect(api.sendCommand.mock.calls[1]![0].args.dataHex).toBe("fee_data_2");
  });

  it("reuses the last meta entry when compiled instructions outnumber meta entries", async () => {
    // Three compiled instructions share the same key but the template only
    // declares two meta entries. The second meta entry (last in queue) is
    // reused for the third instruction — same as single-descriptor reuse.
    api.sendCommand.mockResolvedValue(success);

    const message = {
      compiledInstructions: [
        { programIdIndex: 0, data: new Uint8Array([0x02, 0x00, 0x00, 0x00]) },
        { programIdIndex: 0, data: new Uint8Array([0x02, 0x00, 0x00, 0x00]) },
        { programIdIndex: 0, data: new Uint8Array([0x02, 0x00, 0x00, 0x00]) },
      ],
      allKeys: [makeKey("SYS")],
    };

    const result = {
      type: ClearSignContextType.SOLANA_LIFI as const,
      payload: {
        descriptors: {
          "SYS:02": [
            { data: "normal_data", signature: "sig_n", has_basis_point: false },
            { data: "fee_data", signature: "sig_f", has_basis_point: true },
          ],
        },
        // Only two meta entries for three compiled instructions
        instructions: [
          {
            program_id: "SYS",
            discriminator_hex: "02",
            has_basis_point: false,
          },
          { program_id: "SYS", discriminator_hex: "02", has_basis_point: true },
        ],
      },
      certificate: undefined,
    };

    await provideLifiContext(result as any, makeDeps(buildNormaliser(message)));

    expect(api.sendCommand).toHaveBeenCalledTimes(3);
    expect(api.sendCommand.mock.calls[0]![0].args.dataHex).toBe("normal_data");
    expect(api.sendCommand.mock.calls[1]![0].args.dataHex).toBe("fee_data");
    // Third instruction: meta exhausted, last meta (has_basis_point=true) reused → fee_data
    expect(api.sendCommand.mock.calls[2]![0].args.dataHex).toBe("fee_data");
  });

  it("falls back to FIFO order when meta entries have no has_basis_point", async () => {
    // Older CAL responses may not include has_basis_point on instructions[].
    // With multiple descriptors for the same key and no has_basis_point guidance,
    // popMatchingDescriptor falls back to FIFO (shift in order).
    api.sendCommand.mockResolvedValue(success);

    const message = {
      compiledInstructions: [
        { programIdIndex: 0, data: new Uint8Array([0x02, 0x00, 0x00, 0x00]) },
        { programIdIndex: 0, data: new Uint8Array([0x02, 0x00, 0x00, 0x00]) },
      ],
      allKeys: [makeKey("SYS")],
    };

    const result = {
      type: ClearSignContextType.SOLANA_LIFI as const,
      payload: {
        descriptors: {
          "SYS:02": [
            { data: "first_data", signature: "sig1" },
            { data: "second_data", signature: "sig2" },
          ],
        },
        // No has_basis_point on either meta entry
        instructions: [
          { program_id: "SYS", discriminator_hex: "02" },
          { program_id: "SYS", discriminator_hex: "02" },
        ],
      },
      certificate: undefined,
    };

    await provideLifiContext(result as any, makeDeps(buildNormaliser(message)));

    expect(api.sendCommand).toHaveBeenCalledTimes(2);
    expect(api.sendCommand.mock.calls[0]![0].args.dataHex).toBe("first_data");
    expect(api.sendCommand.mock.calls[1]![0].args.dataHex).toBe("second_data");
  });

  it("reuses a single descriptor for repeated same-type instructions (SPL multi-transfer)", async () => {
    // A real SPL LiFi swap can contain multiple TokenkegQfeZ:03 instructions
    // (e.g. routing through several DEXes). The CAL template only has one
    // descriptor for that key. Each occurrence must get the same descriptor so
    // the firmware descriptor count matches the instruction count.
    api.sendCommand.mockResolvedValue(success);

    const TOKENKEG = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

    const message = {
      compiledInstructions: [
        { programIdIndex: 0, data: new Uint8Array([0x03]) }, // first SPL transfer
        { programIdIndex: 0, data: new Uint8Array([0x03]) }, // second SPL transfer
      ],
      allKeys: [makeKey(TOKENKEG)],
    };

    const result = {
      type: ClearSignContextType.SOLANA_LIFI as const,
      payload: {
        descriptors: {
          [`${TOKENKEG}:03`]: [
            { data: "spl_transfer_data", signature: "spl_sig" },
          ],
        },
        instructions: [{ program_id: TOKENKEG, discriminator_hex: "03" }],
      },
      certificate: undefined,
    };

    await provideLifiContext(result as any, makeDeps(buildNormaliser(message)));

    // Both instructions must get the single descriptor (reused in-place)
    expect(api.sendCommand).toHaveBeenCalledTimes(2);
    expect(api.sendCommand.mock.calls[0]![0].args.dataHex).toBe(
      "spl_transfer_data",
    );
    expect(api.sendCommand.mock.calls[1]![0].args.dataHex).toBe(
      "spl_transfer_data",
    );
  });
});
