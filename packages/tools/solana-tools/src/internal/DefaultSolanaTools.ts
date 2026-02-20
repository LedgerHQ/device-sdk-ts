import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { type Container } from "inversify";

import { type CraftTransactionDAReturnType } from "@api/app-binder/CraftTransactionDeviceActionTypes";
import { type GenerateTransactionDAReturnType } from "@api/app-binder/GenerateTransactionDeviceActionTypes";
import { type SolanaTools } from "@api/SolanaTools";

import { type CraftTransactionUseCase } from "./use-cases/craft-transaction/CraftTransactionUseCase";
import { useCasesTypes } from "./use-cases/di/useCasesTypes";
import { type GenerateTransactionUseCase } from "./use-cases/generate-transaction/GenerateTransactionUseCase";
import { makeContainer } from "./di";

export type DefaultSolanaToolsConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
};

export class DefaultSolanaTools implements SolanaTools {
  private _container: Container;

  constructor({ dmk, sessionId }: DefaultSolanaToolsConstructorArgs) {
    this._container = makeContainer({ dmk, sessionId });
  }

  generateTransaction(
    derivationPath: string,
    skipOpenApp: boolean = false,
  ): GenerateTransactionDAReturnType {
    return this._container
      .get<GenerateTransactionUseCase>(useCasesTypes.GenerateTransactionUseCase)
      .execute(derivationPath, skipOpenApp);
  }

  craftTransaction(
    derivationPath: string,
    serialisedTransaction: string,
    skipOpenApp: boolean = false,
  ): CraftTransactionDAReturnType {
    return this._container
      .get<CraftTransactionUseCase>(useCasesTypes.CraftTransactionUseCase)
      .execute(derivationPath, serialisedTransaction, skipOpenApp);
  }
}
