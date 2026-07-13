/* eslint-disable @typescript-eslint/no-explicit-any */
import { DeviceModelId } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { type PkiCertificateLoader } from "@/modules/multichain/pki/domain/PkiCertificateLoader";
import { type SolanaTrustedNameDataSource } from "@/modules/solana/trusted-name/data/TrustedNameDataSource";
import { ClearSignContextType } from "@/shared/model/ClearSignContext";

import { SolanaTrustedNameContextLoader } from "./TrustedNameContextLoader";

const mockLoggerFactory = () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
});

const mockCertificate = { keyUsageNumber: 4, payload: new Uint8Array([7]) };
const ADDR_A = "Addr11111111111111111111111111111111111111";
const ADDR_B = "Addr22222222222222222222222222222222222222";

describe("SolanaTrustedNameContextLoader", () => {
  let dataSource: SolanaTrustedNameDataSource;
  let certificateLoader: PkiCertificateLoader;

  beforeEach(() => {
    vi.restoreAllMocks();
    dataSource = {
      getTrustedName: vi.fn(),
    };
    certificateLoader = {
      loadCertificate: vi.fn().mockResolvedValue(mockCertificate),
    };
  });

  const makeLoader = () =>
    new SolanaTrustedNameContextLoader(
      dataSource,
      certificateLoader,
      mockLoggerFactory,
    );

  describe("canHandle", () => {
    it("returns true when SOLANA_TRUSTED_NAME is requested with valid requests", () => {
      expect(
        makeLoader().canHandle(
          {
            deviceModelId: DeviceModelId.NANO_X,
            requests: [
              {
                address: ADDR_A,
                challenge: "c",
                sources: ["sns"],
              },
            ],
          },
          [ClearSignContextType.SOLANA_TRUSTED_NAME],
        ),
      ).toBe(true);
    });

    it("returns false when SOLANA_TRUSTED_NAME is not requested", () => {
      expect(
        makeLoader().canHandle(
          {
            requests: [
              {
                address: ADDR_A,
                challenge: "c",
                sources: ["sns"],
              },
            ],
          } as any,
          [ClearSignContextType.SOLANA_TOKEN],
        ),
      ).toBe(false);
    });

    it("returns false on malformed input", () => {
      const loader = makeLoader();
      const types = [ClearSignContextType.SOLANA_TRUSTED_NAME];
      expect(loader.canHandle({ requests: [] } as any, types)).toBe(false);
      expect(
        loader.canHandle(
          {
            requests: [{ address: "", challenge: "c", sources: [] }],
          } as any,
          types,
        ),
      ).toBe(false);
      expect(
        loader.canHandle(
          {
            requests: [{ address: ADDR_A, challenge: "", sources: [] }],
          } as any,
          types,
        ),
      ).toBe(false);
    });
  });

  describe("load", () => {
    it("emits one SOLANA_TRUSTED_NAME per request with Uint8Array payload", async () => {
      vi.spyOn(dataSource, "getTrustedName").mockImplementation(
        async ({ address }) =>
          Right({
            address,
            descriptor: new Uint8Array([address === ADDR_A ? 0xaa : 0xbb]),
            keyId: "name_key",
            keyUsage: "trusted_name",
          }),
      );

      const result = await makeLoader().load({
        deviceModelId: DeviceModelId.NANO_X,
        requests: [
          {
            address: ADDR_A,
            challenge: "c1",
            sources: ["sns"],
          },
          {
            address: ADDR_B,
            challenge: "c2",
            sources: ["cal"],
          },
        ],
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        type: ClearSignContextType.SOLANA_TRUSTED_NAME,
        payload: new Uint8Array([0xaa]),
        certificate: mockCertificate,
      });
      expect(result[1]).toMatchObject({
        type: ClearSignContextType.SOLANA_TRUSTED_NAME,
        payload: new Uint8Array([0xbb]),
      });
    });

    it("emits an ERROR per failing request and keeps the others", async () => {
      vi.spyOn(dataSource, "getTrustedName").mockImplementation(
        async ({ address }) => {
          if (address === ADDR_A) {
            return Right({
              address,
              descriptor: new Uint8Array([0xaa]),
              keyId: "k",
              keyUsage: "u",
            });
          }
          return Left(new Error("upstream-404"));
        },
      );

      const out = await makeLoader().load({
        deviceModelId: DeviceModelId.NANO_X,
        requests: [
          { address: ADDR_A, challenge: "c1", sources: [] },
          { address: ADDR_B, challenge: "c2", sources: [] },
        ],
      });

      expect(out[0]?.type).toBe(ClearSignContextType.SOLANA_TRUSTED_NAME);
      expect(out[1]?.type).toBe(ClearSignContextType.ERROR);
    });

    it("forwards default chain id 900 when input.network is omitted", async () => {
      const spy = vi.spyOn(dataSource, "getTrustedName").mockResolvedValue(
        Right({
          address: ADDR_A,
          descriptor: new Uint8Array([1]),
          keyId: "k",
          keyUsage: "u",
        }),
      );

      await makeLoader().load({
        deviceModelId: DeviceModelId.NANO_X,
        requests: [{ address: ADDR_A, challenge: "c", sources: [] }],
      });

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ network: "900" }),
      );
    });

    it("maps a cluster name to its numeric chain id", async () => {
      const spy = vi.spyOn(dataSource, "getTrustedName").mockResolvedValue(
        Right({
          address: ADDR_A,
          descriptor: new Uint8Array([1]),
          keyId: "k",
          keyUsage: "u",
        }),
      );

      await makeLoader().load({
        deviceModelId: DeviceModelId.NANO_X,
        network: "solana-devnet",
        requests: [{ address: ADDR_A, challenge: "c", sources: [] }],
      });

      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({ network: "901" }),
      );
    });
  });
});
