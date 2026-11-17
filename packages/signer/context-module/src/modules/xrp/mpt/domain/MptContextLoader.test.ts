import { DeviceModelId } from "@ledgerhq/device-management-kit";
import { Left, Right } from "purify-ts";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { type PkiCertificateLoader } from "@/modules/multichain/pki/domain/PkiCertificateLoader";
import { KeyId } from "@/modules/multichain/pki/model/KeyId";
import { KeyUsage } from "@/modules/multichain/pki/model/KeyUsage";
import { type PkiCertificate } from "@/modules/multichain/pki/model/PkiCertificate";
import { type MptDataSource } from "@/modules/xrp/mpt/data/MptDataSource";
import { ClearSignContextType } from "@/shared/model/ClearSignContext";

import { MptContextLoader } from "./MptContextLoader";

const LIQUCF = "06361CB09DBAF9976AB0CFB549A54DC608D1C0DF0AD59EC7";
const DEV = "0476D692478E9F0F8D7F66813EEA2785F3638FFD74F7ED73";

describe("MptContextLoader", () => {
  const certificate: PkiCertificate = {
    keyUsageNumber: 8,
    payload: new Uint8Array([0x01, 0x02]),
  };
  let dataSource: MptDataSource;
  let certificateLoader: PkiCertificateLoader;
  let loader: MptContextLoader;

  beforeEach(() => {
    vi.restoreAllMocks();
    dataSource = { getMptDescriptor: vi.fn() };
    certificateLoader = {
      loadCertificate: vi.fn().mockResolvedValue(certificate),
    };
    loader = new MptContextLoader(dataSource, certificateLoader);
  });

  describe("canHandle", () => {
    const input = {
      mptIssuanceIds: [LIQUCF],
      deviceModelId: DeviceModelId.FLEX,
    };

    it("should handle issuance ids when the MPT type is expected", () => {
      expect(loader.canHandle(input, [ClearSignContextType.XRP_MPT])).toBe(
        true,
      );
    });

    it("should not handle them when the MPT type is not expected", () => {
      expect(loader.canHandle(input, [ClearSignContextType.TRON_TOKEN])).toBe(
        false,
      );
    });

    it.each([
      ["null", null],
      ["an empty object", {}],
      ["no issuance id", { ...input, mptIssuanceIds: [] }],
      ["a non-string issuance id", { ...input, mptIssuanceIds: [42] }],
      ["no device model", { mptIssuanceIds: [LIQUCF] }],
    ])("should not handle %s", (_label, value) => {
      expect(loader.canHandle(value, [ClearSignContextType.XRP_MPT])).toBe(
        false,
      );
    });
  });

  describe("load", () => {
    it("should return one context per MPT with the COIN_META certificate", async () => {
      vi.mocked(dataSource.getMptDescriptor).mockImplementation(
        ({ issuanceId }) => Promise.resolve(Right(`descriptor-${issuanceId}`)),
      );

      const result = await loader.load({
        mptIssuanceIds: [LIQUCF, DEV],
        deviceModelId: DeviceModelId.STAX,
      });

      expect(certificateLoader.loadCertificate).toHaveBeenCalledWith({
        keyId: KeyId.TokenMetadataKey,
        keyUsage: KeyUsage.CoinMeta,
        targetDevice: DeviceModelId.STAX,
      });
      expect(result).toEqual([
        {
          type: ClearSignContextType.XRP_MPT,
          payload: `descriptor-${LIQUCF}`,
          certificate,
        },
        {
          type: ClearSignContextType.XRP_MPT,
          payload: `descriptor-${DEV}`,
          certificate,
        },
      ]);
    });

    it("should return an error context for an MPT unknown to CAL", async () => {
      const error = new Error("not found");
      vi.mocked(dataSource.getMptDescriptor)
        .mockResolvedValueOnce(Right("descriptor"))
        .mockResolvedValueOnce(Left(error));

      const result = await loader.load({
        mptIssuanceIds: [LIQUCF, DEV],
        deviceModelId: DeviceModelId.STAX,
      });

      expect(result).toEqual([
        {
          type: ClearSignContextType.XRP_MPT,
          payload: "descriptor",
          certificate,
        },
        { type: ClearSignContextType.ERROR, error },
      ]);
    });

    it("should return an error context and not call CAL when the certificate is missing", async () => {
      vi.mocked(certificateLoader.loadCertificate).mockResolvedValue(undefined);

      const result = await loader.load({
        mptIssuanceIds: [LIQUCF],
        deviceModelId: DeviceModelId.STAX,
      });

      expect(result).toEqual([
        {
          type: ClearSignContextType.ERROR,
          error: new Error(
            "[ContextModule] MptContextLoader: COIN_META certificate is missing",
          ),
        },
      ]);
      expect(dataSource.getMptDescriptor).not.toHaveBeenCalled();
    });
  });
});
