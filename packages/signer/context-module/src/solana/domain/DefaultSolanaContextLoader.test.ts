/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { DeviceModelId } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { type ContextModuleConfig } from "@/config/model/ContextModuleConfig";
import type { PkiCertificateLoader } from "@/pki/domain/PkiCertificateLoader";
import { KeyUsage } from "@/pki/model/KeyUsage";
import { SolanaContextTypes } from "@/shared/model/SolanaContextTypes";
import { NullLoggerPublisherService } from "@/shared/utils/NullLoggerPublisherService";
import type { SolanaTransactionContext } from "@/solana/domain/solanaContextTypes";
import {
  type SolanaTokenDataSource,
  type TokenDataResponse,
} from "@/solanaToken/data/SolanaTokenDataSource";
import { SolanaTokenContextLoader } from "@/solanaToken/domain/SolanaTokenContextLoader";

describe("SolanaTokenContextLoader", () => {
  let mockDataSource: SolanaTokenDataSource;
  let mockCertLoader: PkiCertificateLoader;

  const bytes = new Uint8Array([0xf0, 0xca, 0xcc, 0x1a]);

  const tokenDataResponse: TokenDataResponse = {
    descriptor: {
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
  } as any;

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
    const config = { cal: { mode } } as unknown as ContextModuleConfig;
    return new SolanaTokenContextLoader(
      mockDataSource,
      config,
      mockCertLoader,
      NullLoggerPublisherService,
    );
  };

  describe("canHandle", () => {
    it("returns true when tokenInternalId is provided", () => {
      const loader = makeLoader("prod");

      expect(
        loader.canHandle(
          {
            tokenInternalId: "abc123",
          } as SolanaTransactionContext,
          SolanaContextTypes.SOLANA_TOKEN,
        ),
      ).toBe(true);
    });

    it("returns false when tokenInternalId is missing or falsy", () => {
      const loader = makeLoader("prod");

      expect(
        loader.canHandle(
          { tokenInternalId: "" } as any,
          SolanaContextTypes.SOLANA_TOKEN,
        ),
      ).toBe(false);
      expect(
        loader.canHandle(
          { tokenInternalId: undefined } as any,
          SolanaContextTypes.SOLANA_TOKEN,
        ),
      ).toBe(false);
      expect(loader.canHandle({} as any, SolanaContextTypes.SOLANA_TOKEN)).toBe(
        false,
      );
    });
  });

  describe("loadField", () => {
    it("returns an error when datasource returns Left(error) and still fetched certificate beforehand", async () => {
      const loader = makeLoader("prod");
      const error = new Error("datasource failed");

      vi.spyOn(mockDataSource, "getTokenInfosPayload").mockResolvedValue(
        Left(error),
      );
      vi.spyOn(mockCertLoader, "loadCertificate").mockResolvedValue({
        keyUsageNumber: 0,
        payload: bytes,
      });

      const result = await loader.loadField(baseCtx);

      expect(mockDataSource.getTokenInfosPayload).toHaveBeenCalledWith({
        tokenInternalId: "token-1",
      });
      expect(mockCertLoader.loadCertificate).toHaveBeenCalledWith({
        keyId: "token_metadata_key",
        keyUsage: KeyUsage.CoinMeta,
        targetDevice: baseCtx.deviceModelId,
      });
      expect(result).toEqual({
        type: SolanaContextTypes.ERROR,
        error,
      });
    });

    it("returns SOLANA_TOKEN with prod signature by default (falsy mode), and includes certificate", async () => {
      const loader = makeLoader(""); // falsy -> default 'prod'

      vi.spyOn(mockDataSource, "getTokenInfosPayload").mockResolvedValue(
        Right(tokenDataResponse),
      );
      vi.spyOn(mockCertLoader, "loadCertificate").mockResolvedValue({
        keyUsageNumber: 0,
        payload: bytes,
      });

      const result = await loader.loadField({
        ...baseCtx,
        tokenInternalId: "token-2",
      });

      expect(result).toEqual({
        type: SolanaContextTypes.SOLANA_TOKEN,
        payload: {
          solanaTokenDescriptor: {
            data: tokenDataResponse.descriptor.data,
            signature: "prod-sig",
          },
        },
        certificate: { keyUsageNumber: 0, payload: bytes },
      });
    });

    it("returns SOLANA_TOKEN with signature matching config.cal.mode", async () => {
      const loader = makeLoader("test");

      vi.spyOn(mockDataSource, "getTokenInfosPayload").mockResolvedValue(
        Right(tokenDataResponse),
      );
      vi.spyOn(mockCertLoader, "loadCertificate").mockResolvedValue({
        keyUsageNumber: 1,
        payload: bytes,
      });

      const result = await loader.loadField({
        ...baseCtx,
        tokenInternalId: "token-3",
      });

      expect(result).toEqual({
        type: SolanaContextTypes.SOLANA_TOKEN,
        payload: {
          solanaTokenDescriptor: {
            data: tokenDataResponse.descriptor.data,
            signature: "test-sig",
          },
        },
        certificate: { keyUsageNumber: 1, payload: bytes },
      });
    });

    it("works even if certificate loader returns undefined (certificate omitted)", async () => {
      const loader = makeLoader("prod");

      vi.spyOn(mockDataSource, "getTokenInfosPayload").mockResolvedValue(
        Right(tokenDataResponse),
      );
      vi.spyOn(mockCertLoader, "loadCertificate").mockResolvedValue(undefined);

      const result = await loader.loadField(baseCtx);

      expect(result).toEqual({
        type: SolanaContextTypes.SOLANA_TOKEN,
        payload: {
          solanaTokenDescriptor: {
            data: tokenDataResponse.descriptor.data,
            signature: "prod-sig",
          },
        },
        certificate: undefined,
      });
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
