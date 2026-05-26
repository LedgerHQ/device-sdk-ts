/* eslint-disable @typescript-eslint/no-explicit-any */

import { DeviceModelId } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  type AleoTokenDataResponse,
  type AleoTokenDataSource,
} from "@/aleoToken/data/AleoTokenDataSource";
import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import type { PkiCertificateLoader } from "@/pki/domain/PkiCertificateLoader";
import { KeyId } from "@/pki/model/KeyId";
import { KeyUsage } from "@/pki/model/KeyUsage";
import { AleoContextTypes } from "@/shared/model/AleoContextTypes";

import { AleoTokenContextLoader } from "../AleoTokenContextLoader";

const mockLoggerFactory = () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
});

describe("AleoTokenContextLoader", () => {
  let mockDataSource: AleoTokenDataSource;
  let mockCertLoader: PkiCertificateLoader;

  const bytes = new Uint8Array([0xf0, 0xca, 0xcc, 0x1a]);

  const tokenDataResponse: AleoTokenDataResponse = {
    descriptor: {
      data: "ALEO_DESCRIPTOR_DATA",
      signatures: {
        prod: "prod-sig",
        test: "test-sig",
      },
    },
  };

  const baseCtx = {
    tokenInternalId: "aleo:usdc",
    deviceModelId: DeviceModelId.FLEX,
  };

  beforeEach(() => {
    vi.restoreAllMocks();

    mockDataSource = {
      getTokenInfosPayload: vi.fn(),
    } as unknown as AleoTokenDataSource;

    mockCertLoader = {
      loadCertificate: vi.fn(),
    } as unknown as PkiCertificateLoader;
  });

  const makeLoader = (mode?: string) => {
    const config = { cal: { mode } } as unknown as ContextModuleServiceConfig;
    return new AleoTokenContextLoader(
      mockDataSource,
      config,
      mockCertLoader,
      mockLoggerFactory,
    );
  };

  describe("canHandle", () => {
    it("returns true when expected type is ALEO_TOKEN and tokenInternalId is present", () => {
      const loader = makeLoader("prod");
      expect(
        loader.canHandle(
          { tokenInternalId: "aleo:usdc" },
          AleoContextTypes.ALEO_TOKEN,
        ),
      ).toBe(true);
    });

    it("returns false when expected type is ERROR", () => {
      const loader = makeLoader("prod");
      expect(
        loader.canHandle(
          { tokenInternalId: "aleo:usdc" },
          AleoContextTypes.ERROR,
        ),
      ).toBe(false);
    });

    it("returns false when tokenInternalId is empty string", () => {
      const loader = makeLoader("prod");
      expect(
        loader.canHandle(
          { tokenInternalId: "" } as any,
          AleoContextTypes.ALEO_TOKEN,
        ),
      ).toBe(false);
    });

    it("returns false when tokenInternalId is missing", () => {
      const loader = makeLoader("prod");
      expect(loader.canHandle({} as any, AleoContextTypes.ALEO_TOKEN)).toBe(
        false,
      );
    });

    it("returns false when field is null", () => {
      const loader = makeLoader("prod");
      expect(loader.canHandle(null, AleoContextTypes.ALEO_TOKEN)).toBe(false);
    });
  });

  describe("loadField", () => {
    it("returns ERROR when datasource returns Left(error)", async () => {
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
        tokenInternalId: "aleo:usdc",
      });
      expect(mockCertLoader.loadCertificate).toHaveBeenCalledWith({
        keyId: KeyId.Erc20MetadataKey,
        keyUsage: KeyUsage.CoinMeta,
        targetDevice: baseCtx.deviceModelId,
      });
      expect(result).toEqual({ type: AleoContextTypes.ERROR, error });
    });

    it("returns ALEO_TOKEN with prod signature when mode is prod (default)", async () => {
      const loader = makeLoader("prod");

      vi.spyOn(mockDataSource, "getTokenInfosPayload").mockResolvedValue(
        Right(tokenDataResponse),
      );
      vi.spyOn(mockCertLoader, "loadCertificate").mockResolvedValue({
        keyUsageNumber: 0,
        payload: bytes,
      });

      const result = await loader.loadField(baseCtx);

      expect(result).toEqual({
        type: AleoContextTypes.ALEO_TOKEN,
        payload: {
          aleoTokenDescriptor: {
            data: tokenDataResponse.descriptor.data,
            signature: "prod-sig",
          },
        },
        certificate: { keyUsageNumber: 0, payload: bytes },
      });
    });

    it("returns ALEO_TOKEN with test signature when mode is test", async () => {
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
        tokenInternalId: "aleo:usdt",
      });

      expect(result).toEqual({
        type: AleoContextTypes.ALEO_TOKEN,
        payload: {
          aleoTokenDescriptor: {
            data: tokenDataResponse.descriptor.data,
            signature: "test-sig",
          },
        },
        certificate: { keyUsageNumber: 1, payload: bytes },
      });
    });

    it("returns ALEO_TOKEN with undefined certificate when certLoader returns undefined", async () => {
      const loader = makeLoader("prod");

      vi.spyOn(mockDataSource, "getTokenInfosPayload").mockResolvedValue(
        Right(tokenDataResponse),
      );
      vi.spyOn(mockCertLoader, "loadCertificate").mockResolvedValue(undefined);

      const result = await loader.loadField(baseCtx);

      expect(result).toEqual({
        type: AleoContextTypes.ALEO_TOKEN,
        payload: {
          aleoTokenDescriptor: {
            data: tokenDataResponse.descriptor.data,
            signature: "prod-sig",
          },
        },
        certificate: undefined,
      });
    });

    it("falls back to prod signature when mode is falsy", async () => {
      const loader = makeLoader("");

      vi.spyOn(mockDataSource, "getTokenInfosPayload").mockResolvedValue(
        Right(tokenDataResponse),
      );
      vi.spyOn(mockCertLoader, "loadCertificate").mockResolvedValue(undefined);

      const result = await loader.loadField(baseCtx);

      expect(result).toMatchObject({
        type: AleoContextTypes.ALEO_TOKEN,
        payload: {
          aleoTokenDescriptor: {
            signature: "prod-sig",
          },
        },
      });
    });
  });
});
