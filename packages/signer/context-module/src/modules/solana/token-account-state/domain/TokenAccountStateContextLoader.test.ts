/* eslint-disable @typescript-eslint/no-explicit-any */
import { DeviceModelId } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { type PkiCertificateLoader } from "@/modules/multichain/pki/domain/PkiCertificateLoader";
import { type TokenAccountStateDataSource } from "@/modules/solana/token-account-state/data/TokenAccountStateDataSource";
import { ClearSignContextType } from "@/shared/model/ClearSignContext";

import { TokenAccountStateContextLoader } from "./TokenAccountStateContextLoader";

const mockLoggerFactory = () => ({
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  subscribers: [],
});

const mockCertificate = {
  keyUsageNumber: 8,
  payload: new Uint8Array([0x42]),
};

const TA_USDC = "TokenAccountUSDCxxxxxxxxxxxxxxxxxxxxxxxxxxx";
const TA_SOL = "TokenAccountSOLxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";

describe("TokenAccountStateContextLoader", () => {
  let dataSource: TokenAccountStateDataSource;
  let certificateLoader: PkiCertificateLoader;

  beforeEach(() => {
    vi.restoreAllMocks();
    dataSource = {
      getTokenAccountState: vi.fn(),
    };
    certificateLoader = {
      loadCertificate: vi.fn().mockResolvedValue(mockCertificate),
    };
  });

  const makeLoader = () =>
    new TokenAccountStateContextLoader(
      dataSource,
      certificateLoader,
      mockLoggerFactory,
    );

  describe("canHandle", () => {
    it("returns true when SOLANA_TOKEN_ACCOUNT_STATE is requested and requests are well-formed", () => {
      expect(
        makeLoader().canHandle(
          {
            deviceModelId: DeviceModelId.NANO_X,
            requests: [{ tokenAccount: TA_USDC, challenge: "c1" }],
          },
          [ClearSignContextType.SOLANA_TOKEN_ACCOUNT_STATE],
        ),
      ).toBe(true);
    });

    it("returns false when SOLANA_TOKEN_ACCOUNT_STATE is not requested", () => {
      expect(
        makeLoader().canHandle(
          {
            deviceModelId: DeviceModelId.NANO_X,
            requests: [{ tokenAccount: TA_USDC, challenge: "c1" }],
          },
          [ClearSignContextType.SOLANA_TOKEN],
        ),
      ).toBe(false);
    });

    it("returns false on malformed input", () => {
      const loader = makeLoader();
      const types = [ClearSignContextType.SOLANA_TOKEN_ACCOUNT_STATE];
      expect(loader.canHandle({ requests: [] } as any, types)).toBe(false);
      expect(
        loader.canHandle(
          { requests: [{ tokenAccount: "", challenge: "c" }] } as any,
          types,
        ),
      ).toBe(false);
      expect(
        loader.canHandle(
          { requests: [{ tokenAccount: TA_USDC, challenge: "" }] } as any,
          types,
        ),
      ).toBe(false);
      expect(loader.canHandle(null, types)).toBe(false);
    });
  });

  describe("load", () => {
    it("emits one SOLANA_TOKEN_ACCOUNT_STATE per request with certificate", async () => {
      vi.spyOn(dataSource, "getTokenAccountState").mockImplementation(
        async ({ tokenAccount }) =>
          Right({
            tokenAccount,
            descriptor: new Uint8Array([0xab, 0xcd]),
            keyId: "k1",
            keyUsage: "coin_meta",
          }),
      );

      const result = await makeLoader().load({
        deviceModelId: DeviceModelId.NANO_X,
        requests: [
          { tokenAccount: TA_USDC, challenge: "c1" },
          { tokenAccount: TA_SOL, challenge: "c2" },
        ],
      });

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        type: ClearSignContextType.SOLANA_TOKEN_ACCOUNT_STATE,
        payload: { descriptor: new Uint8Array([0xab, 0xcd]) },
        certificate: mockCertificate,
      });
      expect(certificateLoader.loadCertificate).toHaveBeenCalledWith({
        keyId: "k1",
        keyUsage: "coin_meta",
        targetDevice: DeviceModelId.NANO_X,
      });
    });

    it("emits an ERROR (not a cert-less success) when the certificate resolves undefined", async () => {
      vi.spyOn(certificateLoader, "loadCertificate").mockResolvedValue(
        undefined,
      );
      vi.spyOn(dataSource, "getTokenAccountState").mockImplementation(
        async ({ tokenAccount }) =>
          Right({
            tokenAccount,
            descriptor: new Uint8Array([0xab]),
            keyId: "k",
            keyUsage: "u",
          }),
      );

      const out = await makeLoader().load({
        deviceModelId: DeviceModelId.NANO_X,
        requests: [{ tokenAccount: TA_USDC, challenge: "c1" }],
      });

      expect(out).toHaveLength(1);
      expect(out[0]?.type).toBe(ClearSignContextType.ERROR);
      expect((out[0] as any).error.message).toMatch(/certificate is missing/);
    });

    it("emits an ERROR per failing request and keeps the others", async () => {
      vi.spyOn(dataSource, "getTokenAccountState").mockImplementation(
        async ({ tokenAccount }) => {
          if (tokenAccount === TA_USDC) {
            return Right({
              tokenAccount,
              descriptor: new Uint8Array([0xab]),
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
          { tokenAccount: TA_USDC, challenge: "c1" },
          { tokenAccount: TA_SOL, challenge: "c2" },
        ],
      });

      expect(out[0]?.type).toBe(
        ClearSignContextType.SOLANA_TOKEN_ACCOUNT_STATE,
      );
      expect(out[1]?.type).toBe(ClearSignContextType.ERROR);
    });
  });
});
