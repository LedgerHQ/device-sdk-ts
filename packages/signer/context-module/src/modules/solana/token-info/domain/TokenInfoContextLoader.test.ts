/* eslint-disable @typescript-eslint/no-explicit-any */
import { DeviceModelId } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { type ContextModuleServiceConfig } from "@/config/model/ContextModuleConfig";
import { type PkiCertificateLoader } from "@/modules/multichain/pki/domain/PkiCertificateLoader";
import { type TokenInfoDataSource } from "@/modules/solana/token-info/data/TokenInfoDataSource";
import { ClearSignContextType } from "@/shared/model/ClearSignContext";

import { TokenInfoContextLoader } from "./TokenInfoContextLoader";

const mockLoggerFactory = () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
});

const mockCertificate = {
  keyUsageNumber: 13,
  payload: new Uint8Array([0x10]),
};

const mockConfig = {
  cal: {
    url: "https://global.api.prd.ledger.com/cal/v1",
    mode: "prod",
    branch: "main",
  },
} as ContextModuleServiceConfig;

const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOL = "So11111111111111111111111111111111111111112";

describe("TokenInfoContextLoader", () => {
  let dataSource: TokenInfoDataSource;
  let certificateLoader: PkiCertificateLoader;

  beforeEach(() => {
    vi.restoreAllMocks();
    dataSource = {
      getTokenInfo: vi.fn(),
    };
    certificateLoader = {
      loadCertificate: vi.fn().mockResolvedValue(mockCertificate),
    };
  });

  const makeLoader = (config = mockConfig) =>
    new TokenInfoContextLoader(
      dataSource,
      config,
      certificateLoader,
      mockLoggerFactory,
    );

  describe("canHandle", () => {
    it("returns true when SOLANA_TOKEN_INFO is requested and mints are non-empty", () => {
      expect(
        makeLoader().canHandle(
          { deviceModelId: DeviceModelId.NANO_X, mints: [USDC] },
          [ClearSignContextType.SOLANA_TOKEN_INFO],
        ),
      ).toBe(true);
    });

    it("returns false when SOLANA_TOKEN_INFO is not requested", () => {
      expect(
        makeLoader().canHandle(
          { deviceModelId: DeviceModelId.NANO_X, mints: [USDC] },
          [ClearSignContextType.SOLANA_TOKEN],
        ),
      ).toBe(false);
    });

    it("returns false on missing / empty / malformed mints", () => {
      const loader = makeLoader();
      const types = [ClearSignContextType.SOLANA_TOKEN_INFO];
      expect(loader.canHandle({} as any, types)).toBe(false);
      expect(loader.canHandle({ mints: [] } as any, types)).toBe(false);
      expect(loader.canHandle({ mints: [""] } as any, types)).toBe(false);
      expect(loader.canHandle(null, types)).toBe(false);
    });
  });

  describe("load", () => {
    it("emits one SOLANA_TOKEN_INFO per unique mint with certificate", async () => {
      vi.spyOn(dataSource, "getTokenInfo").mockImplementation(
        async ({ mint }) =>
          Right({
            mint,
            descriptor: {
              data: `data_${mint.slice(0, 4)}`,
              signatures: { prod: `psig_${mint.slice(0, 4)}`, test: "tsig" },
            },
          }),
      );

      const result = await makeLoader().load({
        deviceModelId: DeviceModelId.NANO_X,
        mints: [USDC, SOL, USDC], // duplicate USDC must dedup
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        type: ClearSignContextType.SOLANA_TOKEN_INFO,
        payload: {
          mint: USDC,
          descriptor: { data: "data_EPjF", signature: "psig_EPjF" },
        },
        certificate: mockCertificate,
      });
      expect(result[1]).toMatchObject({
        type: ClearSignContextType.SOLANA_TOKEN_INFO,
        payload: {
          mint: SOL,
          descriptor: { data: "data_So11", signature: "psig_So11" },
        },
      });
    });

    it("emits an ERROR context per failing mint and keeps the others", async () => {
      vi.spyOn(dataSource, "getTokenInfo").mockImplementation(
        async ({ mint }) => {
          if (mint === USDC) {
            return Right({
              mint,
              descriptor: {
                data: "usdc_data",
                signatures: { prod: "psig", test: "tsig" },
              },
            });
          }
          return Left(new Error("upstream-500"));
        },
      );

      const result = await makeLoader().load({
        deviceModelId: DeviceModelId.NANO_X,
        mints: [USDC, SOL],
      });

      expect(result).toHaveLength(2);
      expect(result[0]?.type).toBe(ClearSignContextType.SOLANA_TOKEN_INFO);
      expect(result[1]?.type).toBe(ClearSignContextType.ERROR);
    });

    it("selects signature based on config.cal.mode (test)", async () => {
      vi.spyOn(dataSource, "getTokenInfo").mockResolvedValue(
        Right({
          mint: USDC,
          descriptor: {
            data: "data",
            signatures: { prod: "p", test: "T" },
          },
        }),
      );

      const result = await makeLoader({
        ...mockConfig,
        cal: { ...mockConfig.cal, mode: "test" },
      } as any).load({ deviceModelId: DeviceModelId.NANO_X, mints: [USDC] });

      expect((result[0] as any).payload.descriptor.signature).toBe("T");
    });

    it("falls back to default network when input.network is omitted", async () => {
      const spy = vi.spyOn(dataSource, "getTokenInfo").mockResolvedValue(
        Right({
          mint: USDC,
          descriptor: { data: "x", signatures: { prod: "p", test: "t" } },
        }),
      );

      await makeLoader().load({
        deviceModelId: DeviceModelId.NANO_X,
        mints: [USDC],
      });

      expect(spy).toHaveBeenCalledWith({
        mint: USDC,
        network: "solana-mainnet",
      });
    });
  });
});
