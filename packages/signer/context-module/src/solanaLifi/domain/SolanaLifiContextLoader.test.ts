/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Left, Right } from "purify-ts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  SolanaContextTypes,
  type SolanaTransactionDescriptorList,
} from "@/shared/model/SolanaContextTypes";
import {
  type GetTransactionDescriptorsResponse,
  type SolanaLifiDataSource,
} from "@/solanaLifi/data/SolanaLifiDataSource";

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
