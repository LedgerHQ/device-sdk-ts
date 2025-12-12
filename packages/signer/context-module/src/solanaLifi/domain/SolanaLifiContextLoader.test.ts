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

  const txDescriptorsResponse: GetTransactionDescriptorsResponse = {
    id: "tpl-1",
    chain_id: 101,
    instructions: [],
    descriptors: responseDescriptorsArray,
  };

  beforeEach(() => {
    vi.restoreAllMocks();
    mockDataSource = {
      getTransactionDescriptorsPayload: vi.fn(),
    } as unknown as SolanaLifiDataSource;
  });

  const makeLoader = () => new SolanaLifiContextLoader(mockDataSource);

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
        payload: expectedPlucked,
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
});
