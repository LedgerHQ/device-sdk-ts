import { type CraftTransactionDAReturnType } from "@api/app-binder/CraftTransactionDeviceActionTypes";
import { type GenerateTransactionDAReturnType } from "@api/app-binder/GenerateTransactionDeviceActionTypes";

export interface SolanaTools {
  generateTransaction(
    derivationPath: string,
    skipOpenApp?: boolean,
  ): GenerateTransactionDAReturnType;

  craftTransaction(
    derivationPath: string,
    serialisedTransaction: string,
    skipOpenApp?: boolean,
  ): CraftTransactionDAReturnType;
}
