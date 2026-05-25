/* eslint-disable @typescript-eslint/no-explicit-any */
import { DeviceModelId } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";

import { type PkiCertificateLoader } from "@/modules/multichain/pki/domain/PkiCertificateLoader";
import { type AltResolutionDataSource } from "@/modules/solana/alt-resolution/data/AltResolutionDataSource";
import { ClearSignContextType } from "@/shared/model/ClearSignContext";

import { AltResolutionContextLoader } from "./AltResolutionContextLoader";

const mockLoggerFactory = () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
});

const mockCertificate = { keyUsageNumber: 8, payload: new Uint8Array([1]) };
const ALT_A = "AltA1111111111111111111111111111111111111111";
const ALT_B = "AltB2222222222222222222222222222222222222222";

describe("AltResolutionContextLoader", () => {
  let dataSource: AltResolutionDataSource;
  let certificateLoader: PkiCertificateLoader;

  beforeEach(() => {
    vi.restoreAllMocks();
    dataSource = {
      getAltResolution: vi.fn(),
    };
    certificateLoader = {
      loadCertificate: vi.fn().mockResolvedValue(mockCertificate),
    };
  });

  const makeLoader = () =>
    new AltResolutionContextLoader(
      dataSource,
      certificateLoader,
      mockLoggerFactory,
    );

  describe("canHandle", () => {
    it("returns true when SOLANA_ALT_RESOLUTION is requested with valid requests", () => {
      expect(
        makeLoader().canHandle(
          {
            deviceModelId: DeviceModelId.NANO_X,
            requests: [{ altAddress: ALT_A, entryIndex: 0, challenge: "c" }],
          },
          [ClearSignContextType.SOLANA_ALT_RESOLUTION],
        ),
      ).toBe(true);
    });

    it("returns false when SOLANA_ALT_RESOLUTION is not requested", () => {
      expect(
        makeLoader().canHandle(
          {
            deviceModelId: DeviceModelId.NANO_X,
            requests: [{ altAddress: ALT_A, entryIndex: 0, challenge: "c" }],
          },
          [ClearSignContextType.SOLANA_TOKEN],
        ),
      ).toBe(false);
    });

    it("rejects out-of-range entryIndex", () => {
      const loader = makeLoader();
      const types = [ClearSignContextType.SOLANA_ALT_RESOLUTION];
      expect(
        loader.canHandle(
          {
            requests: [{ altAddress: ALT_A, entryIndex: -1, challenge: "c" }],
          } as any,
          types,
        ),
      ).toBe(false);
      expect(
        loader.canHandle(
          {
            requests: [{ altAddress: ALT_A, entryIndex: 256, challenge: "c" }],
          } as any,
          types,
        ),
      ).toBe(false);
      expect(
        loader.canHandle(
          {
            requests: [{ altAddress: ALT_A, entryIndex: 1.5, challenge: "c" }],
          } as any,
          types,
        ),
      ).toBe(false);
    });
  });

  describe("load", () => {
    it("emits one SOLANA_ALT_RESOLUTION per request", async () => {
      vi.spyOn(dataSource, "getAltResolution").mockImplementation(
        async ({ altAddress, entryIndex }) =>
          Right({
            altAddress,
            entryIndex,
            descriptor: new Uint8Array([entryIndex]),
            keyId: "alt_key",
            keyUsage: "coin_meta",
          }),
      );

      const result = await makeLoader().load({
        deviceModelId: DeviceModelId.NANO_X,
        requests: [
          { altAddress: ALT_A, entryIndex: 1, challenge: "c1" },
          { altAddress: ALT_B, entryIndex: 7, challenge: "c2" },
        ],
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        type: ClearSignContextType.SOLANA_ALT_RESOLUTION,
        payload: { descriptor: new Uint8Array([1]) },
        certificate: mockCertificate,
      });
      expect(result[1]).toMatchObject({
        type: ClearSignContextType.SOLANA_ALT_RESOLUTION,
        payload: { descriptor: new Uint8Array([7]) },
      });
    });

    it("dedups certificate loads across requests sharing the same (keyId, keyUsage)", async () => {
      vi.spyOn(dataSource, "getAltResolution").mockImplementation(
        async ({ altAddress, entryIndex }) =>
          Right({
            altAddress,
            entryIndex,
            descriptor: new Uint8Array([entryIndex]),
            keyId: "alt_key",
            keyUsage: "coin_meta",
          }),
      );

      await makeLoader().load({
        deviceModelId: DeviceModelId.NANO_X,
        requests: [
          { altAddress: ALT_A, entryIndex: 0, challenge: "c1" },
          { altAddress: ALT_A, entryIndex: 1, challenge: "c2" },
          { altAddress: ALT_B, entryIndex: 2, challenge: "c3" },
        ],
      });

      expect(certificateLoader.loadCertificate).toHaveBeenCalledTimes(1);
    });

    it("issues distinct cert loads when (keyId, keyUsage) differ", async () => {
      vi.spyOn(dataSource, "getAltResolution").mockImplementation(
        async ({ altAddress, entryIndex }) =>
          Right({
            altAddress,
            entryIndex,
            descriptor: new Uint8Array([entryIndex]),
            keyId: altAddress === ALT_A ? "alt_key_a" : "alt_key_b",
            keyUsage: "coin_meta",
          }),
      );

      await makeLoader().load({
        deviceModelId: DeviceModelId.NANO_X,
        requests: [
          { altAddress: ALT_A, entryIndex: 0, challenge: "c1" },
          { altAddress: ALT_B, entryIndex: 1, challenge: "c2" },
        ],
      });

      expect(certificateLoader.loadCertificate).toHaveBeenCalledTimes(2);
    });

    it("emits an ERROR per failing request and keeps the others", async () => {
      vi.spyOn(dataSource, "getAltResolution").mockImplementation(
        async ({ altAddress }) => {
          if (altAddress === ALT_A) {
            return Right({
              altAddress,
              entryIndex: 0,
              descriptor: new Uint8Array([0xaa]),
              keyId: "k",
              keyUsage: "u",
            });
          }
          return Left(new Error("upstream-500"));
        },
      );

      const out = await makeLoader().load({
        deviceModelId: DeviceModelId.NANO_X,
        requests: [
          { altAddress: ALT_A, entryIndex: 0, challenge: "c1" },
          { altAddress: ALT_B, entryIndex: 1, challenge: "c2" },
        ],
      });

      expect(out[0]?.type).toBe(ClearSignContextType.SOLANA_ALT_RESOLUTION);
      expect(out[1]?.type).toBe(ClearSignContextType.ERROR);
    });
  });
});
