import { type ContextModule } from "@ledgerhq/context-module";
import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { type Container } from "inversify";

import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type SignPersonalMessageDAReturnType } from "@api/app-binder/SignPersonalMessageDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type SignTypedDataDAReturnType } from "@api/app-binder/SignTypedDataDeviceActionTypes";
import { type AddressOptions } from "@api/model/AddressOptions";
import { type Transaction } from "@api/model/Transaction";
import { type TransactionOptions } from "@api/model/TransactionOptions";
import { type TypedData } from "@api/model/TypedData";
import { type SignerEth } from "@api/SignerEth";
import { addressTypes } from "@internal/address/di/addressTypes";
import { type GetAddressUseCase } from "@internal/address/use-case/GetAddressUseCase";
import { makeContainer } from "@internal/di";
import { messageTypes } from "@internal/message/di/messageTypes";
import { type SignMessageUseCase } from "@internal/message/use-case/SignMessageUseCase";
import { transactionTypes } from "@internal/transaction/di/transactionTypes";
import { type SignTransactionUseCase } from "@internal/transaction/use-case/SignTransactionUseCase";
import { typedDataTypes } from "@internal/typed-data/di/typedDataTypes";
import { type SignTypedDataUseCase } from "@internal/typed-data/use-case/SignTypedDataUseCase";

type DefaultSignerConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
  contextModule: ContextModule;
};

export class DefaultSignerEth implements SignerEth {
  private _container: Container;

  constructor({ dmk, sessionId, contextModule }: DefaultSignerConstructorArgs) {
    this._container = makeContainer({ dmk, sessionId, contextModule });
  }

  signTransaction(
    derivationPath: string,
    transaction: Transaction,
    options?: TransactionOptions,
  ): SignTransactionDAReturnType {
    return this._container
      .get<SignTransactionUseCase>(transactionTypes.SignTransactionUseCase)
      .execute(derivationPath, transaction, options);
  }

  signMessage(
    _derivationPath: string,
    _message: string | Uint8Array,
  ): SignPersonalMessageDAReturnType {
    return this._container
      .get<SignMessageUseCase>(messageTypes.SignMessageUseCase)
      .execute(_derivationPath, _message);
  }

  signTypedData(
    _derivationPath: string,
    _typedData: TypedData,
  ): SignTypedDataDAReturnType {
    return this._container
      .get<SignTypedDataUseCase>(typedDataTypes.SignTypedDataUseCase)
      .execute(_derivationPath, _typedData);
  }

  getAddress(
    _derivationPath: string,
    _options?: AddressOptions,
  ): GetAddressDAReturnType {
    return this._container
      .get<GetAddressUseCase>(addressTypes.GetAddressUseCase)
      .execute(_derivationPath, _options);
  }
}
