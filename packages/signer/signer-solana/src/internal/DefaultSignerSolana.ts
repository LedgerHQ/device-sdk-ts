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

import { GetAddressUseCase } from "./use-cases/address/GetAddressUseCase";
import { useCasesTypes } from "./use-cases/di/useCasesTypes";
import { makeContainer } from "./di";

export type DefaultSignerSolanaConstructorArgs = {
  sdk: DeviceSdk;
  sessionId: DeviceSessionId;
};

export class DefaultSignerSolana implements SignerSolana {
  private _container: Container;

  constructor({ sdk, sessionId }: DefaultSignerSolanaConstructorArgs) {
    this._container = makeContainer({ sdk, sessionId });
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
    derivationPath: string,
    options?: AddressOptions,
  ): GetAddressDAReturnType {
    return this._container
      .get<GetAddressUseCase>(useCasesTypes.GetAddressUseCase)
      .execute(derivationPath, options);
  }

  getAppConfiguration(): GetAppConfigurationDAReturnType {
    return {} as GetAppConfigurationDAReturnType;
  }
}
