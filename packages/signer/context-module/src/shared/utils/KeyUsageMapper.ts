export class KeyUsageMapper {
  static mapKeyUsageForFirmware(keyUsageString: string): number {
    let keyUsageNumber = -1;

    switch (keyUsageString) {
      case "genuine_check":
        keyUsageNumber = 1;
        break;
      case "exchange_payload":
        keyUsageNumber = 2;
        break;
      case "nft_meta":
        keyUsageNumber = 3;
        break;
      case "trusted_name":
        keyUsageNumber = 4;
        break;
      case "backup_provider":
        keyUsageNumber = 5;
        break;
      case "protect_orchestrator":
        keyUsageNumber = 6;
        break;
      case "plugin_meta":
        keyUsageNumber = 7;
        break;
      case "coin_meta":
        keyUsageNumber = 8;
        break;
      case "seed_id_auth":
        keyUsageNumber = 9;
        break;
      case "web3checks":
        keyUsageNumber = 10;
        break;
      default:
        break;
    }

    return keyUsageNumber;
  }
}
