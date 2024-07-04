import { ContextModule } from "@ledgerhq/context-module";
import { DeviceSdk } from "@ledgerhq/device-sdk-core";
import { Container } from "inversify";

import {
  Address,
  AddressOptions,
  Signature,
  Transaction,
  TransactionOptions,
  TypedData,
} from "@api/index";
import { KeyringEth } from "@api/KeyringEth";
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
  contextModule: ContextModule;
};

export class DefaultKeyringEth implements KeyringEth {
  private _container: Container;

  constructor({ sdk, contextModule }: DefaultKeyringConstructorArgs) {
    this._container = makeContainer({ sdk, contextModule });
  }

  async signTransaction(
    derivationPath: string,
    transaction: Transaction,
    options?: TransactionOptions,
  ): Promise<Signature> {
    return this._container
      .get<SignTransactionUseCase>(transactionTypes.SignTransactionUseCase)
      .execute(derivationPath, transaction, options);
  }

  async signMessage(
    _derivationPath: string,
    _message: string,
  ): Promise<Signature> {
    return this._container
      .get<SignMessageUseCase>(messageTypes.SignMessageUseCase)
      .execute(_derivationPath, _message);
  }

  async signTypedData(
    _derivationPath: string,
    _typedData: TypedData,
  ): Promise<Signature> {
    return this._container
      .get<SignTypedDataUseCase>(typedDataTypes.SignTypedDataUseCase)
      .execute(_derivationPath, _typedData);
  }

  async getAddress(
    _derivationPath: string,
    _options?: AddressOptions,
  ): Promise<Address> {
    return this._container
      .get<GetAddressUseCase>(addressTypes.GetAddressUseCase)
      .execute(_derivationPath, _options);
  }
}
