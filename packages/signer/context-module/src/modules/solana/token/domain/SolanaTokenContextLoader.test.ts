/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { DeviceModelId } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import type { PkiCertificateLoader } from "@/modules/chain-agnostic/pki/domain/PkiCertificateLoader";
import { KeyUsage } from "@/modules/chain-agnostic/pki/model/KeyUsage";
import type { SolanaTransactionContext } from "@/modules/solana/owner-info/domain/solanaContextTypes";
import {
  type SolanaTokenDataSource,
  type TokenDataResponse,
} from "@/modules/solana/token/data/SolanaTokenDataSource";
import { ClearSignContextType } from "@/shared/model/ClearSignContext";

import { SolanaTokenContextLoader } from "./SolanaTokenContextLoader";

const mockLoggerFactory = () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
});

describe("SolanaTokenContextLoader", () => {
  let mockDataSource: SolanaTokenDataSource;
  let mockCertLoader: PkiCertificateLoader;

  const bytes = new Uint8Array([0xf0, 0xca, 0xcc, 0x1a]);

  const tokenDataResponse: TokenDataResponse = {
    descriptor: {
      // The loader just forwards this; exact shape isn't important for the test
      data: { symbol: "SOL", name: "Solana", decimals: 9 } as any,
      signatures: {
        prod: "prod-sig",
        test: "test-sig",
      } as any,
    },
  } as any;

  const baseCtx = {
    tokenInternalId: "token-1",
    deviceModelId: DeviceModelId.FLEX,
  };

  beforeEach(() => {
    vi.restoreAllMocks();

    mockDataSource = {
      getTokenInfosPayload: vi.fn(),
    } as unknown as SolanaTokenDataSource;

    mockCertLoader = {
      loadCertificate: vi.fn(),
    } as unknown as PkiCertificateLoader;
  });

  const makeLoader = (mode?: string) => {
    const config = { cal: { mode } } as unknown as ContextModuleServiceConfig;
    return new SolanaTokenContextLoader(
      mockDataSource,
      config,
      mockCertLoader,
      mockLoggerFactory,
    );
  };

  describe("canHandle", () => {
    it("returns true when tokenInternalId is provided and SOLANA_TOKEN is in expectedTypes", () => {
      const loader = makeLoader("prod");

      expect(
        loader.canHandle(
          {
            tokenInternalId: "abc123",
          } as SolanaTransactionContext,
          [ClearSignContextType.SOLANA_TOKEN],
        ),
      ).toBe(true);
    });

    it("returns false when SOLANA_TOKEN is not in expectedTypes", () => {
      const loader = makeLoader("prod");

      expect(
        loader.canHandle(
          { tokenInternalId: "abc123" } as SolanaTransactionContext,
          [ClearSignContextType.SOLANA_LIFI],
        ),
      ).toBe(false);
    });

    it("returns false when tokenInternalId is missing or falsy", () => {
      const loader = makeLoader("prod");

      expect(
        loader.canHandle({ tokenInternalId: "" } as any, [
          ClearSignContextType.SOLANA_TOKEN,
        ]),
      ).toBe(false);
      expect(
        loader.canHandle({ tokenInternalId: undefined } as any, [
          ClearSignContextType.SOLANA_TOKEN,
        ]),
      ).toBe(false);
      expect(
        loader.canHandle({} as any, [ClearSignContextType.SOLANA_TOKEN]),
      ).toBe(false);
    });
  });

  describe("load", () => {
    it("returns an array with an error when datasource returns Left(error) (certificate still retrieved)", async () => {
      const loader = makeLoader("prod");
      const error = new Error("datasource failed");

      vi.spyOn(mockDataSource, "getTokenInfosPayload").mockResolvedValue(
        Left(error),
      );
      vi.spyOn(mockCertLoader, "loadCertificate").mockResolvedValue({
        keyUsageNumber: 0,
        payload: bytes,
      });

      const result = await loader.load(baseCtx);

      expect(mockDataSource.getTokenInfosPayload).toHaveBeenCalledWith({
        tokenInternalId: "token-1",
      });
      expect(mockCertLoader.loadCertificate).toHaveBeenCalledWith({
        keyId: "token_metadata_key",
        keyUsage: KeyUsage.CoinMeta,
        targetDevice: baseCtx.deviceModelId,
      });
      expect(result).toEqual([
        {
          type: ClearSignContextType.ERROR,
          error,
        },
      ]);
    });

    it("returns SOLANA_TOKEN array with prod signature by default (falsy mode) and includes certificate", async () => {
      const loader = makeLoader(""); // falsy -> default 'prod'

      vi.spyOn(mockDataSource, "getTokenInfosPayload").mockResolvedValue(
        Right(tokenDataResponse),
      );
      vi.spyOn(mockCertLoader, "loadCertificate").mockResolvedValue({
        keyUsageNumber: 0,
        payload: bytes,
      });

      const result = await loader.load({
        ...baseCtx,
        tokenInternalId: "token-2",
      });

      expect(result).toEqual([
        {
          type: ClearSignContextType.SOLANA_TOKEN,
          payload: {
            solanaTokenDescriptor: {
              data: tokenDataResponse.descriptor.data,
              signature: "prod-sig",
            },
          },
          certificate: { keyUsageNumber: 0, payload: bytes },
        },
      ]);
    });

    it("returns SOLANA_TOKEN array with signature matching config.cal.mode", async () => {
      const loader = makeLoader("test");

      vi.spyOn(mockDataSource, "getTokenInfosPayload").mockResolvedValue(
        Right(tokenDataResponse),
      );
      vi.spyOn(mockCertLoader, "loadCertificate").mockResolvedValue({
        keyUsageNumber: 1,
        payload: bytes,
      });

      const result = await loader.load({
        ...baseCtx,
        tokenInternalId: "token-3",
      });

      expect(result).toEqual([
        {
          type: ClearSignContextType.SOLANA_TOKEN,
          payload: {
            solanaTokenDescriptor: {
              data: tokenDataResponse.descriptor.data,
              signature: "test-sig",
            },
          },
          certificate: { keyUsageNumber: 1, payload: bytes },
        },
      ]);
    });

    it("returns ERROR when certificate loader returns undefined", async () => {
      const loader = makeLoader("prod");

      vi.spyOn(mockDataSource, "getTokenInfosPayload").mockResolvedValue(
        Right(tokenDataResponse),
      );
      vi.spyOn(mockCertLoader, "loadCertificate").mockResolvedValue(undefined);

      const result = await loader.load(baseCtx);

      expect(result).toEqual([
        {
          type: ClearSignContextType.ERROR,
          error: new Error(
            "[ContextModule] SolanaTokenContextLoader: tokenMetadataCertificate is missing",
          ),
        },
      ]);
    });
  });

  describe("pluckTokenData (private)", () => {
    it("picks the signature for the configured mode", () => {
      const loader = makeLoader("test");
      const pluck = (loader as any).pluckTokenData.bind(loader);

      const result = pluck(tokenDataResponse);

      expect(result).toEqual({
        solanaTokenDescriptor: {
          data: tokenDataResponse.descriptor.data,
          signature: "test-sig",
        },
      });
    });

    it("falls back to 'prod' when config.cal.mode is falsy", () => {
      const loader = makeLoader(undefined as any);
      const result = (loader as any).pluckTokenData(tokenDataResponse);

      expect(result).toEqual({
        solanaTokenDescriptor: {
          data: tokenDataResponse.descriptor.data,
          signature: "prod-sig",
        },
      });
    });
  });
});
