/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { DeviceModelId } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PkiCertificateLoader } from "@/modules/multichain/pki/domain/PkiCertificateLoader";
import type { OwnerInfoDataSource } from "@/modules/solana/owner-info/data/OwnerInfoDataSource";
import { ClearSignContextType } from "@/shared/model/ClearSignContext";

import { OwnerInfoContextLoader } from "./OwnerInfoContextLoader";
import type { SolanaTransactionContext } from "./solanaContextTypes";

const mockLoggerFactory = () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
});

describe("OwnerInfoContextLoader", () => {
  let mockDataSource: OwnerInfoDataSource;
  let mockCertLoader: PkiCertificateLoader;

  const mockCert = {
    keyUsageNumber: 4,
    payload: new Uint8Array([0xaa, 0xbb, 0xcc]),
  };

  const baseCtx: SolanaTransactionContext = {
    deviceModelId: DeviceModelId.FLEX,
    tokenAddress: "SomeTokenAddress",
  };

  beforeEach(() => {
    vi.restoreAllMocks();

    mockDataSource = {
      getOwnerInfo: vi.fn(),
    } as unknown as OwnerInfoDataSource;

    mockCertLoader = {
      loadCertificate: vi.fn(),
    } as unknown as PkiCertificateLoader;
  });

  const makeLoader = () =>
    new OwnerInfoContextLoader(
      mockDataSource,
      mockCertLoader,
      mockLoggerFactory,
    );

  describe("canHandle", () => {
    it("returns true when SOLANA_BASIC_TRUSTED_NAME is in expectedTypes and tokenAddress is present", () => {
      const loader = makeLoader();
      expect(
        loader.canHandle(baseCtx, [
          ClearSignContextType.SOLANA_BASIC_TRUSTED_NAME,
        ]),
      ).toBe(true);
    });

    it("returns true when createATA is present (and tokenAddress absent)", () => {
      const loader = makeLoader();
      const ctx: SolanaTransactionContext = {
        deviceModelId: DeviceModelId.FLEX,
        createATA: { address: "addr", mintAddress: "mint" },
      };
      expect(
        loader.canHandle(ctx, [ClearSignContextType.SOLANA_BASIC_TRUSTED_NAME]),
      ).toBe(true);
    });

    it("returns false when SOLANA_BASIC_TRUSTED_NAME is not in expectedTypes", () => {
      const loader = makeLoader();
      expect(
        loader.canHandle(baseCtx, [ClearSignContextType.SOLANA_TOKEN]),
      ).toBe(false);
    });

    it("returns false when neither tokenAddress nor createATA is present", () => {
      const loader = makeLoader();
      const ctx: SolanaTransactionContext = {
        deviceModelId: DeviceModelId.FLEX,
      };
      expect(
        loader.canHandle(ctx, [ClearSignContextType.SOLANA_BASIC_TRUSTED_NAME]),
      ).toBe(false);
    });

    it("returns false for non-object inputs", () => {
      const loader = makeLoader();
      expect(
        loader.canHandle(null, [
          ClearSignContextType.SOLANA_BASIC_TRUSTED_NAME,
        ]),
      ).toBe(false);
      expect(
        loader.canHandle("string", [
          ClearSignContextType.SOLANA_BASIC_TRUSTED_NAME,
        ]),
      ).toBe(false);
    });
  });

  describe("load", () => {
    it("returns SOLANA_BASIC_TRUSTED_NAME context with cert when datasource returns Right with tlvDescriptor", async () => {
      const loader = makeLoader();
      const tlvDescriptor = new Uint8Array([0x01, 0x02, 0x03]);

      vi.spyOn(mockCertLoader, "loadCertificate").mockResolvedValue(mockCert);
      vi.spyOn(mockDataSource, "getOwnerInfo").mockResolvedValue(
        Right({ tlvDescriptor }),
      );

      const result = await loader.load(baseCtx);

      expect(mockCertLoader.loadCertificate).toHaveBeenCalledWith({
        keyId: "domain_metadata_key",
        keyUsage: "trusted_name",
        targetDevice: DeviceModelId.FLEX,
      });
      expect(mockDataSource.getOwnerInfo).toHaveBeenCalledWith(baseCtx);

      expect(result).toEqual([
        {
          type: ClearSignContextType.SOLANA_BASIC_TRUSTED_NAME,
          payload: tlvDescriptor,
          certificate: mockCert,
        },
      ]);
    });

    it("returns empty array when datasource returns Right with undefined tlvDescriptor", async () => {
      const loader = makeLoader();

      vi.spyOn(mockCertLoader, "loadCertificate").mockResolvedValue(mockCert);
      vi.spyOn(mockDataSource, "getOwnerInfo").mockResolvedValue(
        Right({ tlvDescriptor: undefined as unknown as Uint8Array }),
      );

      const result = await loader.load(baseCtx);

      expect(result).toEqual([]);
    });

    it("returns error when PKI certificate is missing", async () => {
      const loader = makeLoader();

      vi.spyOn(mockCertLoader, "loadCertificate").mockResolvedValue(undefined);
      // getOwnerInfo should NOT be called if cert is missing
      vi.spyOn(mockDataSource, "getOwnerInfo");

      const result = await loader.load(baseCtx);

      expect(mockDataSource.getOwnerInfo).not.toHaveBeenCalled();
      expect(result).toEqual([
        {
          type: ClearSignContextType.ERROR,
          error: expect.objectContaining({
            message: expect.stringContaining(
              "trustedNamePKICertificate is missing",
            ),
          }),
        },
      ]);
    });

    it("returns error when datasource returns Left(error)", async () => {
      const loader = makeLoader();
      const error = new Error("owner info fetch failed");

      vi.spyOn(mockCertLoader, "loadCertificate").mockResolvedValue(mockCert);
      vi.spyOn(mockDataSource, "getOwnerInfo").mockResolvedValue(Left(error));

      const result = await loader.load(baseCtx);

      expect(result).toEqual([
        {
          type: ClearSignContextType.ERROR,
          error,
        },
      ]);
    });
  });
});
