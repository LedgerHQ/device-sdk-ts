import { KeyUsage } from "@/pki/model/KeyUsage";

const KEY_USAGE_EXCHANGE_PAYLOAD = 2;
const KEY_USAGE_NFT_META = 3;
const KEY_USAGE_TRUSTED_NAME = 4;
const KEY_USAGE_BACKUP_PROVIDER = 5;
const KEY_USAGE_PROTECT_ORCHESTRATOR = 6;
const KEY_USAGE_PLUGIN_META = 7;
const KEY_USAGE_COIN_META = 8;
const KEY_USAGE_SEED_ID_AUTH = 9;
const KEY_USAGE_TX_SIMULATION_SIGNER = 10;
const KEY_USAGE_CALLDATA = 11;
const KEY_USAGE_NETWORK = 12;
const KEY_USAGE_SWAP_TEMPLATE = 13;
const KEY_USAGE_LES_MULTISIG = 14;
const KEY_USAGE_GATED_SIGNING = 15;

export class KeyUsageMapper {
  private static keyUsageMap = new Map<KeyUsage, number>([
    [KeyUsage.GenuineCheck, 1],
    [KeyUsage.ExchangePayload, KEY_USAGE_EXCHANGE_PAYLOAD],
    [KeyUsage.NftMeta, KEY_USAGE_NFT_META],
    [KeyUsage.TrustedName, KEY_USAGE_TRUSTED_NAME],
    [KeyUsage.BackupProvider, KEY_USAGE_BACKUP_PROVIDER],
    [KeyUsage.ProtectOrchestrator, KEY_USAGE_PROTECT_ORCHESTRATOR],
    [KeyUsage.PluginMeta, KEY_USAGE_PLUGIN_META],
    [KeyUsage.CoinMeta, KEY_USAGE_COIN_META],
    [KeyUsage.SeedIdAuth, KEY_USAGE_SEED_ID_AUTH],
    [KeyUsage.TxSimulationSigner, KEY_USAGE_TX_SIMULATION_SIGNER],
    [KeyUsage.Calldata, KEY_USAGE_CALLDATA],
    [KeyUsage.Network, KEY_USAGE_NETWORK],
    [KeyUsage.SwapTemplate, KEY_USAGE_SWAP_TEMPLATE],
    [KeyUsage.LESMultisig, KEY_USAGE_LES_MULTISIG],
    [KeyUsage.GatedSigning, KEY_USAGE_GATED_SIGNING],
  ]);

  static mapKeyUsageForFirmware(keyUsage: string): number {
    if (Object.values(KeyUsage).includes(keyUsage as KeyUsage)) {
      return this.keyUsageMap.get(keyUsage as KeyUsage) ?? -1;
    }
    return -1;
  }
}
