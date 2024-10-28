import { DeviceSdk, DeviceSessionId } from "@ledgerhq/device-management-kit";
import { Container } from "inversify";

import { GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { GetAppConfigurationDAReturnType } from "@api/app-binder/GetAppConfigurationDeviceActionTypes";
import { SignMessageDAReturnType } from "@api/app-binder/SignMessageDeviceActionTypes";
import { SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { AddressOptions } from "@api/model/AddressOption";
import { Transaction } from "@api/model/Transaction";
import { TransactionOptions } from "@api/model/TransactionOptions";
import { SignerSolana } from "@api/SignerSolana";

import { makeContainer } from "./di";

export type DefaultSignerSolanaConstructorArgs = {
  sdk: DeviceSdk;
  sessionId: DeviceSessionId;
};

export class DefaultSignerSolana implements SignerSolana {
  private _container: Container;

  constructor({ sdk, sessionId }: DefaultSignerSolanaConstructorArgs) {
    this._container = makeContainer({ sdk, sessionId });
    // FIXME: avoid lint error for now
    console.log(this._container);
  }

  signTransaction(
    _derivationPath: string,
    _transaction: Transaction,
    _options?: TransactionOptions,
  ): SignTransactionDAReturnType {
    return {} as SignTransactionDAReturnType;
  }

  signMessage(
    _derivationPath: string,
    _message: string,
  ): SignMessageDAReturnType {
    return {} as SignMessageDAReturnType;
  }

  getAddress(
    _derivationPath: string,
    _options?: AddressOptions,
  ): GetAddressDAReturnType {
    return {} as GetAddressDAReturnType;
  }

  getAppConfiguration(): GetAppConfigurationDAReturnType {
    return {} as GetAppConfigurationDAReturnType;
  }
}
