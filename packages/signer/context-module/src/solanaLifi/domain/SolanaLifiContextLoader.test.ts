/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Left, Right } from "purify-ts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { type SolanaTransactionContext } from "@/solana/domain/solanaContextTypes";
import {
  type GetTransactionDescriptorsResponse,
  type SolanaLifiDataSource,
} from "@/solanaLifi/data/SolanaLifiDataSource";
import { SolanaContextTypes } from "@/solanaToken/domain/SolanaTokenContext";

import {
  type SolanaLifiContextResult,
  type SolanaTransactionDescriptorList,
} from "./SolanaLifiContext";
import { SolanaLifiContextLoader } from "./SolanaLifiContextLoader";

describe("SolanaLifiContextLoader", () => {
  let mockDataSource: SolanaLifiDataSource;

  const descriptors: SolanaTransactionDescriptorList = {
    // Shape not important for the loader: it's plucked verbatim
    swap: { programId: "SomeProgram", accounts: [], data: "abc123" } as any,
    bridge: {
      programId: "AnotherProgram",
      accounts: [],
      data: "def456",
    } as any,
  };

  const txDescriptorsResponse: GetTransactionDescriptorsResponse = {
    descriptors,
  } as any;

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
        loader.canHandle({ templateId: "tpl-123" } as SolanaTransactionContext),
      ).toBe(true);
    });

    it("returns false when templateId is missing or falsy", () => {
      const loader = makeLoader();

      expect(loader.canHandle({ templateId: "" } as any)).toBe(false);
      expect(loader.canHandle({ templateId: undefined } as any)).toBe(false);
      expect(loader.canHandle({} as any)).toBe(false);
    });
  });

  describe("load", () => {
    it("returns an error when templateId is missing", async () => {
      const loader = makeLoader();

      const result = (await loader.load({} as any)) as SolanaLifiContextResult;

      expect(result.type).toBe(SolanaContextTypes.ERROR);
      expect((result as any).error).toBeInstanceOf(Error);
      expect((result as any).error.message).toBe(
        "[ContextModule] SolanaLifiContextLoader: templateId is missing",
      );
      expect(
        mockDataSource.getTransactionDescriptorsPayload,
      ).not.toHaveBeenCalled();
    });

    it("returns an error when datasource returns Left(error)", async () => {
      const loader = makeLoader();
      const error = new Error("boom");
      vi.spyOn(
        mockDataSource,
        "getTransactionDescriptorsPayload",
      ).mockResolvedValue(Left(error));

      const input = { templateId: "tpl-err" } as SolanaTransactionContext;
      const result = await loader.load(input);

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

      const input = { templateId: "tpl-ok" } as SolanaTransactionContext;
      const result = await loader.load(input);

      expect(
        mockDataSource.getTransactionDescriptorsPayload,
      ).toHaveBeenCalledWith({
        templateId: "tpl-ok",
      });
      expect(result).toEqual({
        type: SolanaContextTypes.SOLANA_LIFI,
        payload: descriptors,
      });
    });
  });

  describe("pluckTransactionData (private)", () => {
    it("simply returns the descriptors object from the response", () => {
      const loader = makeLoader();
      const pluck = (loader as any).pluckTransactionData.bind(loader);

      const result = pluck(txDescriptorsResponse);

      expect(result).toEqual(descriptors);
    });
  });
});
