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
  }): CraftTransactionDAReturnType;
}
