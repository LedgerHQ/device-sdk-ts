import { ContextModule } from "@ledgerhq/context-module";
import { DeviceSdk, DeviceSessionId } from "@ledgerhq/device-sdk-core";
import { Container } from "inversify";

import { GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { SignPersonalMessageDAReturnType } from "@api/app-binder/SignPersonalMessageDeviceActionTypes";
import { SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { SignTypedDataDAReturnType } from "@api/app-binder/SignTypedDataDeviceActionTypes";
import { KeyringEth } from "@api/KeyringEth";
import { AddressOptions } from "@api/model/AddressOptions";
import { Transaction } from "@api/model/Transaction";
import { TransactionOptions } from "@api/model/TransactionOptions";
import { TypedData } from "@api/model/TypedData";
import { addressTypes } from "@internal/address/di/addressTypes";
import { GetAddressUseCase } from "@internal/address/use-case/GetAddressUseCase";
import { makeContainer } from "@internal/di";
import { messageTypes } from "@internal/message/di/messageTypes";
import { SignMessageUseCase } from "@internal/message/use-case/SignMessageUseCase";
import { transactionTypes } from "@internal/transaction/di/transactionTypes";
import { SignTransactionUseCase } from "@internal/transaction/use-case/SignTransactionUseCase";
import { typedDataTypes } from "@internal/typed-data/di/typedDataTypes";
import { SignTypedDataUseCase } from "@internal/typed-data/use-case/SignTypedDataUseCase";

type DefaultKeyringConstructorArgs = {
  sdk: DeviceSdk;
  sessionId: DeviceSessionId;
  contextModule: ContextModule;
};

export class DefaultKeyringEth implements KeyringEth {
  private _container: Container;

  constructor({
    sdk,
    sessionId,
    contextModule,
  }: DefaultKeyringConstructorArgs) {
    this._container = makeContainer({ sdk, sessionId, contextModule });
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
    _message: string,
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
