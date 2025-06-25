import { type ContextModule } from "@ledgerhq/context-module";
import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { type Container } from "inversify";

import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type GetAppConfigurationDAReturnType } from "@api/app-binder/GetAppConfigurationDeviceActionTypes";
import { type SignMessageDAReturnType } from "@api/app-binder/SignMessageDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type AddressOptions } from "@api/model/AddressOption";
import { type MessageOptions } from "@api/model/MessageOptions";
import { type Transaction } from "@api/model/Transaction";
import { type SignerSolana } from "@api/SignerSolana";

import { type GetAddressUseCase } from "./use-cases/address/GetAddressUseCase";
import { type GetAppConfigurationUseCase } from "./use-cases/app-configuration/GetAppConfigurationUseCase";
import { useCasesTypes } from "./use-cases/di/useCasesTypes";
import { type SignMessageUseCase } from "./use-cases/message/SignMessageUseCase";
import { type SignTransactionUseCase } from "./use-cases/transaction/SignTransactionUseCase";
import { makeContainer } from "./di";

export type DefaultSignerSolanaConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
  contextModule: ContextModule;
};

export class DefaultSignerSolana implements SignerSolana {
  private _container: Container;

  constructor({
    dmk,
    sessionId,
    contextModule,
  }: DefaultSignerSolanaConstructorArgs) {
    this._container = makeContainer({ dmk, sessionId, contextModule });
  }

  signTransaction(
    derivationPath: string,
    transaction: Transaction,
  ): SignTransactionDAReturnType {
    return this._container
      .get<SignTransactionUseCase>(useCasesTypes.SignTransactionUseCase)
      .execute(derivationPath, transaction);
  }

  signMessage(
    derivationPath: string,
    message: string,
    options?: MessageOptions,
  ): SignMessageDAReturnType {
    return this._container
      .get<SignMessageUseCase>(useCasesTypes.SignMessageUseCase)
      .execute(derivationPath, message, options);
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
