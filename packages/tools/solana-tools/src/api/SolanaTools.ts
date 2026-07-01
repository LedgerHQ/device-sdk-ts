import { type CraftTransactionDAReturnType } from "@api/app-binder/CraftTransactionDeviceActionTypes";
import { type GenerateTransactionDAReturnType } from "@api/app-binder/GenerateTransactionDeviceActionTypes";

export interface SolanaTools {
  generateTransaction(
    derivationPath: string,
    skipOpenApp?: boolean,
  ): GenerateTransactionDAReturnType;

  craftTransaction(args: {
    derivationPath: string;
    serialisedTransaction?: string;
    transactionSignature?: string;
    rpcUrl?: string;
    skipOpenApp?: boolean;
    // Optional explicit old to new address map, base58 keyed. Overrides the
    // auto-detected payer and ATA entries on a key collision.
    replacements?: Readonly<Record<string, string>>;
  }): CraftTransactionDAReturnType;
}
