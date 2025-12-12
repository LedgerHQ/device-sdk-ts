/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Left, Right } from "purify-ts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  SolanaContextTypes,
  type SolanaTransactionDescriptor,
  type SolanaTransactionDescriptorList,
} from "@/shared/model/SolanaContextTypes";
import {
  type GetTransactionDescriptorsResponse,
  type SolanaLifiDataSource,
} from "@/solanaLifi/data/SolanaLifiDataSource";

import { SolanaLifiContextLoader } from "./SolanaLifiContextLoader";

const mockLoggerFactory = () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
});

describe("SolanaLifiContextLoader", () => {
  let mockDataSource: SolanaLifiDataSource;

  const makeDescriptor = (data: string): SolanaTransactionDescriptor => ({
    data,
    descriptorType: "swap_template",
    descriptorVersion: "v1",
    signatures: { test: "deadbeef" },
  });

  const responseDescriptorsArray: GetTransactionDescriptorsResponse["descriptors"] =
    [
      {
        program_id: "SomeProgram",
        discriminator_hex: "1",
        descriptor: makeDescriptor("abc123"),
      },
      {
        program_id: "AnotherProgram",
        // discriminator_hex intentionally omitted -> defaults to "0"
        descriptor: makeDescriptor("def456"),
      },
    ];

  const expectedPlucked: SolanaTransactionDescriptorList = {
    "SomeProgram:1": makeDescriptor("abc123"),
    "AnotherProgram:0": makeDescriptor("def456"),
  };

  const responseInstructionsArray: GetTransactionDescriptorsResponse["instructions"] =
    [
      {
        program_id: "SomeProgram",
        discriminator: 1,
        discriminator_hex: "1",
      },
      {
        program_id: "AnotherProgram",
        // discriminator_hex intentionally omitted
      },
    ];

  const txDescriptorsResponse: GetTransactionDescriptorsResponse = {
    id: "tpl-1",
    chain_id: 101,
    instructions: responseInstructionsArray,
    descriptors: responseDescriptorsArray,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    mockDataSource = {
      getTransactionDescriptorsPayload: vi.fn(),
    } as unknown as SolanaLifiDataSource;
  });

  const makeLoader = () =>
    new SolanaLifiContextLoader(mockDataSource, mockLoggerFactory);

  describe("canHandle", () => {
    it("returns true when templateId is provided", () => {
      const loader = makeLoader();

      expect(
        loader.canHandle(
          {
            templateId: "tpl-123",
            deviceModelId: "nanoS" as any,
          },
          SolanaContextTypes.SOLANA_LIFI,
        ),
      ).toBe(true);
    });

    it("returns false when templateId is missing or falsy", () => {
      const loader = makeLoader();

      expect(
        loader.canHandle(
          { templateId: "" } as any,
          SolanaContextTypes.SOLANA_LIFI,
        ),
      ).toBe(false);
      expect(
        loader.canHandle(
          { templateId: undefined } as any,
          SolanaContextTypes.SOLANA_LIFI,
        ),
      ).toBe(false);
      expect(loader.canHandle({} as any, SolanaContextTypes.SOLANA_LIFI)).toBe(
        false,
      );
    });
  });

  describe("loadField", () => {
    it("returns an error when datasource returns Left(error)", async () => {
      const loader = makeLoader();
      const error = new Error("boom");

      vi.spyOn(
        mockDataSource,
        "getTransactionDescriptorsPayload",
      ).mockResolvedValue(Left(error));

      const input = { templateId: "tpl-err", deviceModelId: "nanoS" as any };
      const result = await loader.loadField(input);

      expect(
        mockDataSource.getTransactionDescriptorsPayload,
      ).toHaveBeenCalledWith({
        templateId: "tpl-err",
      });

      expect(result).toEqual({
        type: SolanaContextTypes.ERROR,
        error,
      });
    });

    it("returns SOLANA_LIFI with plucked descriptors when datasource returns Right(value)", async () => {
      const loader = makeLoader();

      vi.spyOn(
        mockDataSource,
        "getTransactionDescriptorsPayload",
      ).mockResolvedValue(Right(txDescriptorsResponse));

      const input = { templateId: "tpl-ok", deviceModelId: "nanoS" as any };
      const result = await loader.loadField(input);

      expect(
        mockDataSource.getTransactionDescriptorsPayload,
      ).toHaveBeenCalledWith({
        templateId: "tpl-ok",
      });

      expect(result).toEqual({
        type: SolanaContextTypes.SOLANA_LIFI,
        payload: {
          descriptors: expectedPlucked,
          instructions: [
            { program_id: "SomeProgram", discriminator_hex: "1" },
            { program_id: "AnotherProgram" },
          ],
        },
      });
    });
  });

  describe("pluckTransactionData (private)", () => {
    it("returns a map keyed by `${program_id}:${discriminator_hex ?? '0'}`", () => {
      const loader = makeLoader();
      const pluck = (loader as any).pluckTransactionData.bind(loader);

      const result: SolanaTransactionDescriptorList = pluck(
        txDescriptorsResponse,
      );

      expect(result).toEqual(expectedPlucked);
    });
  });

  describe("extractInstructionsMeta (private)", () => {
    it("returns instruction metadata from the API response", () => {
      const loader = makeLoader();
      const extract = (loader as any).extractInstructionsMeta.bind(loader);

      const result = extract(txDescriptorsResponse);

      expect(result).toEqual([
        { program_id: "SomeProgram", discriminator_hex: "1" },
        { program_id: "AnotherProgram" },
      ]);
    });

    it("returns empty array when instructions are missing", () => {
      const loader = makeLoader();
      const extract = (loader as any).extractInstructionsMeta.bind(loader);

      const result = extract({
        ...txDescriptorsResponse,
        instructions: undefined,
      });

      expect(result).toEqual([]);
    });
  });

  describe("real CAL payload (LiFi template 4c694669)", () => {
    const realApiResponse: GetTransactionDescriptorsResponse = {
      id: "4c694669",
      chain_id: 101,
      instructions: [
        {
          program_id: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
          discriminator: 1,
          discriminator_hex: "1",
        },
        {
          program_id: "11111111111111111111111111111111",
          discriminator: 2,
          discriminator_hex: "2",
        },
        {
          program_id: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
          discriminator: 3.0753642362361016e18,
          discriminator_hex: "2aade37a97cb17e0",
        },
        {
          program_id: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
          discriminator: 9.339575302786589e18,
          discriminator_hex: "819cd641339b2148",
        },
        { program_id: "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr" },
        {
          program_id: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
          discriminator: 1,
          discriminator_hex: "1",
        },
        { program_id: "3i5JeuZuUxeKtVysUnwQNGerJP2bSMX9fTFfS4Nxe3Br" },
        {
          program_id: "ComputeBudget111111111111111111111111111111",
          discriminator: 2,
          discriminator_hex: "2",
        },
        {
          program_id: "ComputeBudget111111111111111111111111111111",
          discriminator: 3,
          discriminator_hex: "3",
        },
        {
          program_id: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
          discriminator: 3,
          discriminator_hex: "3",
        },
        {
          program_id: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
          discriminator: 17,
          discriminator_hex: "11",
        },
        { program_id: "BrdgN2RPzEMWF96ZbnnJaUtQDQx7VRXYaHHbYCBvceWB" },
      ],
      descriptors: [
        {
          program_id: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
          discriminator_hex: "1",
          descriptor: {
            data: "atoken_1",
            descriptorType: "swap_template",
            descriptorVersion: "v1",
            signatures: { test: "sig_atoken" },
          },
        },
        {
          program_id: "11111111111111111111111111111111",
          discriminator_hex: "2",
          descriptor: {
            data: "system_2",
            descriptorType: "swap_template",
            descriptorVersion: "v1",
            signatures: { test: "sig_system" },
          },
        },
        {
          program_id: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
          discriminator_hex: "2aade37a97cb17e0",
          descriptor: {
            data: "jup_route",
            descriptorType: "swap_template",
            descriptorVersion: "v1",
            signatures: { test: "sig_jup_route" },
          },
        },
        {
          program_id: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
          discriminator_hex: "819cd641339b2148",
          descriptor: {
            data: "jup_shared",
            descriptorType: "swap_template",
            descriptorVersion: "v1",
            signatures: { test: "sig_jup_shared" },
          },
        },
        {
          program_id: "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
          descriptor: {
            data: "memo",
            descriptorType: "swap_template",
            descriptorVersion: "v1",
            signatures: { test: "sig_memo" },
          },
        },
        {
          program_id: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
          discriminator_hex: "1",
          descriptor: {
            data: "atoken_1",
            descriptorType: "swap_template",
            descriptorVersion: "v1",
            signatures: { test: "sig_atoken" },
          },
        },
        {
          program_id: "3i5JeuZuUxeKtVysUnwQNGerJP2bSMX9fTFfS4Nxe3Br",
          descriptor: {
            data: "3i5jeu",
            descriptorType: "swap_template",
            descriptorVersion: "v1",
            signatures: { test: "sig_3i5jeu" },
          },
        },
        {
          program_id: "ComputeBudget111111111111111111111111111111",
          discriminator_hex: "2",
          descriptor: {
            data: "cb_2",
            descriptorType: "swap_template",
            descriptorVersion: "v1",
            signatures: { test: "sig_cb2" },
          },
        },
        {
          program_id: "ComputeBudget111111111111111111111111111111",
          discriminator_hex: "3",
          descriptor: {
            data: "cb_3",
            descriptorType: "swap_template",
            descriptorVersion: "v1",
            signatures: { test: "sig_cb3" },
          },
        },
        {
          program_id: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
          discriminator_hex: "3",
          descriptor: {
            data: "tokenkeg_3",
            descriptorType: "swap_template",
            descriptorVersion: "v1",
            signatures: { test: "sig_tk3" },
          },
        },
        {
          program_id: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA",
          discriminator_hex: "11",
          descriptor: {
            data: "tokenkeg_11",
            descriptorType: "swap_template",
            descriptorVersion: "v1",
            signatures: { test: "sig_tk11" },
          },
        },
        {
          program_id: "BrdgN2RPzEMWF96ZbnnJaUtQDQx7VRXYaHHbYCBvceWB",
          descriptor: {
            data: "brdg",
            descriptorType: "swap_template",
            descriptorVersion: "v1",
            signatures: { test: "sig_brdg" },
          },
        },
      ],
    };

    it("produces 11 unique descriptor keys (ATokenGP:1 appears twice but deduplicates)", () => {
      const loader = makeLoader();
      const pluck = (loader as any).pluckTransactionData.bind(loader);

      const result: SolanaTransactionDescriptorList = pluck(realApiResponse);
      const keys = Object.keys(result);

      // 12 descriptors but ATokenGP:1 appears twice -> 11 unique keys
      expect(keys).toHaveLength(11);
    });

    it("creates distinct keys for same program_id with different discriminators", () => {
      const loader = makeLoader();
      const pluck = (loader as any).pluckTransactionData.bind(loader);

      const result: SolanaTransactionDescriptorList = pluck(realApiResponse);

      // JUP6 has two different discriminators -> two distinct entries
      expect(
        result["JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4:2aade37a97cb17e0"]
          ?.data,
      ).toBe("jup_route");
      expect(
        result["JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4:819cd641339b2148"]
          ?.data,
      ).toBe("jup_shared");

      // ComputeBudget has discriminator 2 and 3
      expect(
        result["ComputeBudget111111111111111111111111111111:2"]?.data,
      ).toBe("cb_2");
      expect(
        result["ComputeBudget111111111111111111111111111111:3"]?.data,
      ).toBe("cb_3");

      // TokenkegQ has discriminator 3 and 11
      expect(
        result["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA:3"]?.data,
      ).toBe("tokenkeg_3");
      expect(
        result["TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA:11"]?.data,
      ).toBe("tokenkeg_11");
    });

    it("uses :0 suffix for programs without a discriminator", () => {
      const loader = makeLoader();
      const pluck = (loader as any).pluckTransactionData.bind(loader);

      const result: SolanaTransactionDescriptorList = pluck(realApiResponse);

      expect(
        result["MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr:0"]?.data,
      ).toBe("memo");
      expect(
        result["3i5JeuZuUxeKtVysUnwQNGerJP2bSMX9fTFfS4Nxe3Br:0"]?.data,
      ).toBe("3i5jeu");
      expect(
        result["BrdgN2RPzEMWF96ZbnnJaUtQDQx7VRXYaHHbYCBvceWB:0"]?.data,
      ).toBe("brdg");
    });

    it("extracts 12 instruction metadata entries preserving order and discriminators", () => {
      const loader = makeLoader();
      const extract = (loader as any).extractInstructionsMeta.bind(loader);

      const result = extract(realApiResponse);

      expect(result).toHaveLength(12);

      // First: ATokenGP with discriminator
      expect(result[0]).toEqual({
        program_id: "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL",
        discriminator_hex: "1",
      });
      // JUP6 route (8-byte discriminator)
      expect(result[2]).toEqual({
        program_id: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
        discriminator_hex: "2aade37a97cb17e0",
      });
      // JUP6 shared (8-byte discriminator)
      expect(result[3]).toEqual({
        program_id: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
        discriminator_hex: "819cd641339b2148",
      });
      // Memo: no discriminator
      expect(result[4]).toEqual({
        program_id: "MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr",
      });
      // BrdgN2: no discriminator (last entry)
      expect(result[11]).toEqual({
        program_id: "BrdgN2RPzEMWF96ZbnnJaUtQDQx7VRXYaHHbYCBvceWB",
      });
    });

    it("loadField returns full payload with descriptors and instructions from real API response", async () => {
      const loader = makeLoader();

      vi.spyOn(
        mockDataSource,
        "getTransactionDescriptorsPayload",
      ).mockResolvedValue(Right(realApiResponse));

      const input = { templateId: "4c694669", deviceModelId: "nanoS" as any };
      const result = await loader.loadField(input);

      expect(result).toMatchObject({
        type: SolanaContextTypes.SOLANA_LIFI,
        payload: {
          descriptors: expect.objectContaining({
            "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4:2aade37a97cb17e0":
              expect.objectContaining({ data: "jup_route" }),
            "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4:819cd641339b2148":
              expect.objectContaining({ data: "jup_shared" }),
          }),
          instructions: expect.arrayContaining([
            expect.objectContaining({
              program_id: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
              discriminator_hex: "2aade37a97cb17e0",
            }),
            expect.objectContaining({
              program_id: "JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4",
              discriminator_hex: "819cd641339b2148",
            }),
          ]),
        },
      });

      expect(Object.keys((result as any).payload.descriptors)).toHaveLength(11);
      expect((result as any).payload.instructions).toHaveLength(12);
    });
  });
});
