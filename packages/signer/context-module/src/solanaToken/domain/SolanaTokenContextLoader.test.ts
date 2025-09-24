/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Left, Right } from "purify-ts";

import { type ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import { ClearSignContextType } from "@/shared/model/ClearSignContext";
import {
  type SolanaTokenDataSource,
  type TokenDataResponse,
} from "@/solanaToken/data/SolanaTokenDataSource";

import { type SolanaTokenContextInput } from "./SolanaTokenContext";
import { SolanaTokenContextLoader } from "./SolanaTokenContextLoader";

describe("SolanaTokenContextLoader", () => {
  let mockDataSource: SolanaTokenDataSource;

  const tokenDataResponse: TokenDataResponse = {
    descriptor: {
      data: { symbol: "SOL", name: "Solana", decimals: 9 },
      signatures: {
        prod: "prod-sig",
        test: "test-sig",
      } as any,
    },
  } as any;

  beforeEach(() => {
    vi.restoreAllMocks();
    mockDataSource = {
      getTokenInfosPayload: vi.fn(),
    } as unknown as SolanaTokenDataSource;
  });

  const makeLoader = (mode?: string) => {
    const config = { cal: { mode } } as unknown as ContextModuleConfig;
    return new SolanaTokenContextLoader(mockDataSource, config);
  };

  describe("canHandle", () => {
    it("should return true when tokenInternalId is provided", () => {
      const loader = makeLoader("prod");

      expect(
        loader.canHandle({
          tokenInternalId: "abc123",
        } as SolanaTokenContextInput),
      ).toBe(true);
    });

    it("should return false when tokenInternalId is missing or falsy", () => {
      const loader = makeLoader("prod");

      expect(loader.canHandle({ tokenInternalId: "" } as any)).toBe(false);
      expect(loader.canHandle({ tokenInternalId: undefined } as any)).toBe(
        false,
      );
      expect(loader.canHandle({} as any)).toBe(false);
    });
  });

  describe("load", () => {
    it("should return an error when datasource returns an error", async () => {
      // given
      const loader = makeLoader("prod");
      const error = new Error("error");
      vi.spyOn(mockDataSource, "getTokenInfosPayload").mockResolvedValue(
        Left(error),
      );

      // when
      const input = { tokenInternalId: "token-1" } as SolanaTokenContextInput;
      const result = await loader.load(input);

      // then
      expect(mockDataSource.getTokenInfosPayload).toHaveBeenCalledWith({
        tokenInternalId: "token-1",
      });
      expect(result).toEqual({
        type: ClearSignContextType.ERROR,
        error,
      });
    });

    it("should return a SOLANA_TOKEN payload with prod signature by default", async () => {
      // given (falsy mode, falls back to 'prod')
      const loader = makeLoader("");
      vi.spyOn(mockDataSource, "getTokenInfosPayload").mockResolvedValue(
        Right(tokenDataResponse),
      );

      // when
      const input = { tokenInternalId: "token-2" } as SolanaTokenContextInput;
      const result = await loader.load(input);

      // then
      expect(result).toEqual({
        type: ClearSignContextType.SOLANA_TOKEN,
        payload: {
          descriptor: {
            data: tokenDataResponse.descriptor.data,
            signature: "prod-sig",
          },
        },
      });
    });

    it("should return a SOLANA_TOKEN payload with signature matching config.cal.mode", async () => {
      // given
      const loader = makeLoader("test");
      vi.spyOn(mockDataSource, "getTokenInfosPayload").mockResolvedValue(
        Right(tokenDataResponse),
      );

      // when
      const input = { tokenInternalId: "token-3" } as SolanaTokenContextInput;
      const result = await loader.load(input);

      // then
      expect(result).toEqual({
        type: ClearSignContextType.SOLANA_TOKEN,
        payload: {
          descriptor: {
            data: tokenDataResponse.descriptor.data,
            signature: "test-sig",
          },
        },
      });
    });
  });

  describe("pluckTokenData (private)", () => {
    it("should pick the signature for the configured mode", () => {
      const loader = makeLoader("test");
      const pluck = (loader as any).pluckTokenData.bind(loader);

      const result = pluck(tokenDataResponse);

      expect(result).toEqual({
        descriptor: {
          data: tokenDataResponse.descriptor.data,
          signature: "test-sig",
        },
      });
    });

    it("should fall back to 'prod' when config.cal.mode is falsy", () => {
      const loader = makeLoader(undefined as any);
      const result = (loader as any).pluckTokenData(tokenDataResponse);

      expect(result).toEqual({
        descriptor: {
          data: tokenDataResponse.descriptor.data,
          signature: "prod-sig",
        },
      });
    });
  });
});
