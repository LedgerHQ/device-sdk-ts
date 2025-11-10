import { type ContextModule } from "@ledgerhq/context-module";
import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { type Container } from "inversify";

import { type GenerateTransactionDAReturnType } from "@api/app-binder/GenerateTransactionDeviceActionTypes";
import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type GetAppConfigurationDAReturnType } from "@api/app-binder/GetAppConfigurationDeviceActionTypes";
import { type SwapTransactionSignerDAReturnType } from "@api/app-binder/SwapTransactionSignerDeviceActionTypes";
import { type AddressOptions } from "@api/model/AddressOption";
import { type SolanaTools } from "@api/SolanaTools";

import { type GetAddressUseCase } from "./use-cases/address/GetAddressUseCase";
import { type GetAppConfigurationUseCase } from "./use-cases/app-configuration/GetAppConfigurationUseCase";
import { useCasesTypes } from "./use-cases/di/useCasesTypes";
import { type GenerateTransactionUseCase } from "./use-cases/generateTransaction/GenerateTransactionUseCase";
import { type SwapTransactionSignerUseCase } from "./use-cases/swap-transaction-signer/SwapTransactionSignerUseCase";
import { makeContainer } from "./di";

export type DefaultSolanaToolsConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
  contextModule: ContextModule;
};

export class DefaultSolanaTools implements SolanaTools {
  private _container: Container;

  constructor({
    dmk,
    sessionId,
    contextModule,
  }: DefaultSolanaToolsConstructorArgs) {
    this._container = makeContainer({ dmk, sessionId, contextModule });
  }

  generateTransaction(derivationPath: string): GenerateTransactionDAReturnType {
    return this._container
      .get<GenerateTransactionUseCase>(useCasesTypes.GenerateTransactionUseCase)
      .execute(derivationPath);
  }

  swapTransactionSigner(
    derivationPath: string,
    serialisedTransaction: string,
  ): SwapTransactionSignerDAReturnType {
    return this._container
      .get<SwapTransactionSignerUseCase>(
        useCasesTypes.SwapTransactionSignerUseCase,
      )
      .execute(derivationPath, serialisedTransaction);
  }

  getAddress(
    derivationPath: string,
    options?: AddressOptions,
  ): GetAddressDAReturnType {
    return this._container
      .get<GetAddressUseCase>(useCasesTypes.GetAddressUseCase)
      .execute(derivationPath, options);
  }

  getAppConfiguration(): GetAppConfigurationDAReturnType {
    return this._container
      .get<GetAppConfigurationUseCase>(useCasesTypes.GetAppConfigurationUseCase)
      .execute();
  }
}
