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
import { type MessageOptions } from "@api/model/MessageOptions";
import { type TransactionOptions } from "@api/model/TransactionOptions";
import { type TypedData } from "@api/model/TypedData";
import { type TypedDataOptions } from "@api/model/TypedDataOptions";
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
import { SignDelegationAuthorizationDAReturnType } from "@api/app-binder/SignDelegationAuthorizationTypes";
import { SignDelegationAuthorizationUseCase } from "./eip7702/use-case/SignDelegationAuthorizationUseCase";
import { eip7702Types } from "./eip7702/di/eip7702Types";

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
    transaction: Uint8Array,
    options?: TransactionOptions,
  ): SignTransactionDAReturnType {
    return this._container
      .get<SignTransactionUseCase>(transactionTypes.SignTransactionUseCase)
      .execute(derivationPath, transaction, options);
  }

  signMessage(
    derivationPath: string,
    message: string | Uint8Array,
    options?: MessageOptions,
  ): SignPersonalMessageDAReturnType {
    return this._container
      .get<SignMessageUseCase>(messageTypes.SignMessageUseCase)
      .execute(derivationPath, message, options);
  }

  signTypedData(
    derivationPath: string,
    typedData: TypedData,
    options?: TypedDataOptions,
  ): SignTypedDataDAReturnType {
    return this._container
      .get<SignTypedDataUseCase>(typedDataTypes.SignTypedDataUseCase)
      .execute(derivationPath, typedData, options);
  }

  getAddress(
    derivationPath: string,
    options?: AddressOptions,
  ): GetAddressDAReturnType {
    return this._container
      .get<GetAddressUseCase>(addressTypes.GetAddressUseCase)
      .execute(derivationPath, options);
  }

  signDelegationAuthorization(
    _derivationPath: string,
    _chainId: number,
    _contractAddress: string,
    _nonce: number,
  ): SignDelegationAuthorizationDAReturnType {
    return this._container
      .get<SignDelegationAuthorizationUseCase>(
        eip7702Types.SignDelegationAuthorizationUseCase,
      )
      .execute(_derivationPath, _nonce, _contractAddress, _chainId);
  }
}
