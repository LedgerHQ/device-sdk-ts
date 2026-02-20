import { KeyUsage } from "@/pki/model/KeyUsage";

export class KeyUsageMapper {
  private static keyUsageMap = new Map<KeyUsage, number>([
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
    [KeyUsage.LESMultisig, 14],
    [KeyUsage.SwapTemplate, 13],
  ]);

  static mapKeyUsageForFirmware(keyUsage: string): number {
    if (Object.values(KeyUsage).includes(keyUsage as KeyUsage)) {
      return this.keyUsageMap.get(keyUsage as KeyUsage) ?? -1;
    }
    return -1;
  }
}
