import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { type Container } from "inversify";

import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type GetVersionDAReturnType } from "@api/app-binder/GetVersionDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import {
  type AddressOptions,
  type SignerIcp,
  type TransactionOptions,
} from "@api/SignerIcp";
import { makeContainer } from "@internal/di";
import { addressTypes } from "@internal/use-cases/address/di/addressTypes";
import { type GetAddressUseCase } from "@internal/use-cases/address/GetAddressUseCase";
import { configTypes } from "@internal/use-cases/config/di/configTypes";
import { type GetAppConfigurationUseCase } from "@internal/use-cases/config/GetAppConfigurationUseCase";
import { transactionTypes } from "@internal/use-cases/transaction/di/transactionTypes";
import { type SignTransactionUseCase } from "@internal/use-cases/transaction/SignTransactionUseCase";

type DefaultSignerIcpConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
};

export class DefaultSignerIcp implements SignerIcp {
  private readonly _container: Container;

  constructor({ dmk, sessionId }: DefaultSignerIcpConstructorArgs) {
    this._container = makeContainer({ dmk, sessionId });
  }

  getAppConfiguration(): GetVersionDAReturnType {
    return this._container
      .get<GetAppConfigurationUseCase>(configTypes.GetAppConfigurationUseCase)
      .execute();
  }

  getAddress(
    derivationPath: string,
    options?: AddressOptions,
  ): GetAddressDAReturnType {
    return this._container
      .get<GetAddressUseCase>(addressTypes.GetAddressUseCase)
      .execute(derivationPath, options);
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
}
