import { KeyUsage } from "@/pki/model/KeyUsage";
import { KeyUsageMapper } from "@/shared/utils/KeyUsageMapper";

describe("KeyUsageMapper", () => {
  describe("mapKeyUsageForFirmware", () => {
    it.each([
      [KeyUsage.GenuineCheck, 1],
      [KeyUsage.ExchangePayload, 2],
      [KeyUsage.NftMeta, 3],
      [KeyUsage.TrustedName, 4],
      [KeyUsage.BackupProvider, 5],
      [KeyUsage.ProtectOrchestrator, 6],
      [KeyUsage.PluginMeta, 7],
      [KeyUsage.CoinMeta, 8],
      [KeyUsage.SeedIdAuth, 9],
      [KeyUsage.TxSimulationSigner, 10],
      [KeyUsage.Calldata, 11],
      [KeyUsage.Network, 12],
    ])(`should map key usage %s to %i`, (keyUsage, expected) => {
      // WHEN
      const result = KeyUsageMapper.mapKeyUsageForFirmware(keyUsage);

      // THEN
      expect(result).toEqual(expected);
    });

    it("should return -1 when key usage is not found", () => {
      // WHEN
      const result = KeyUsageMapper.mapKeyUsageForFirmware(
        "unknown" as KeyUsage,
      );

      // THEN
      expect(result).toEqual(-1);
    });
  });
});
