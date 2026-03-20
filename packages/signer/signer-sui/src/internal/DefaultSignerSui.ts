import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { type Container } from "inversify";

import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type GetVersionDAReturnType } from "@api/app-binder/GetVersionDeviceActionTypes";
import { type SignPersonalMessageDAReturnType } from "@api/app-binder/SignPersonalMessageDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type AddressOptions } from "@api/model/AddressOptions";
import { type MessageOptions } from "@api/model/MessageOptions";
import { type TransactionOptions } from "@api/model/TransactionOptions";
import { type SignerSui } from "@api/SignerSui";

import { makeContainer } from "./di";
import { type GetAddressUseCase } from "./use-cases/address/GetAddressUseCase";
import { useCasesTypes } from "./use-cases/di/useCasesTypes";
import { type SignPersonalMessageUseCase } from "./use-cases/message/SignPersonalMessageUseCase";
import { type SignTransactionUseCase } from "./use-cases/transaction/SignTransactionUseCase";
import { type GetVersionUseCase } from "./use-cases/version/GetVersionUseCase";

export type DefaultSignerSuiConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
};

export class DefaultSignerSui implements SignerSui {
  private _container: Container;

  constructor({ dmk, sessionId }: DefaultSignerSuiConstructorArgs) {
    this._container = makeContainer({ dmk, sessionId });
  }

  getVersion(): GetVersionDAReturnType {
    return this._container
      .get<GetVersionUseCase>(useCasesTypes.GetVersionUseCase)
      .execute();
  }

  getAddress(
    derivationPath: string,
    options?: AddressOptions,
  ): GetAddressDAReturnType {
    return this._container
      .get<GetAddressUseCase>(useCasesTypes.GetAddressUseCase)
      .execute(derivationPath, options);
  }

  signTransaction(
    derivationPath: string,
    transaction: Uint8Array,
    options?: TransactionOptions,
  ): SignTransactionDAReturnType {
    return this._container
      .get<SignTransactionUseCase>(useCasesTypes.SignTransactionUseCase)
      .execute(derivationPath, transaction, options);
  }

  signPersonalMessage(
    derivationPath: string,
    message: Uint8Array,
    options?: MessageOptions,
  ): SignPersonalMessageDAReturnType {
    return this._container
      .get<SignPersonalMessageUseCase>(
        useCasesTypes.SignPersonalMessageUseCase,
      )
      .execute(derivationPath, message, options);
  }
}
