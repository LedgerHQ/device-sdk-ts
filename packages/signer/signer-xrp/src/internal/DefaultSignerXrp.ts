import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { type Container } from "inversify";

import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type GetAppConfigDAReturnType } from "@api/app-binder/GetAppConfigDeviceActionTypes";
import { type SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { type AddressOptions } from "@api/model/AddressOptions";
import { type AppConfigOptions } from "@api/model/AppConfigOptions";
import { type TransactionOptions } from "@api/model/TransactionOptions";
import { type SignerXrp } from "@api/SignerXrp";
import { makeContainer } from "@internal/di";
import { addressTypes } from "@internal/use-cases/address/di/addressTypes";
import { type GetAddressUseCase } from "@internal/use-cases/address/GetAddressUseCase";
import { configTypes } from "@internal/use-cases/config/di/configTypes";
import { type GetAppConfigUseCase } from "@internal/use-cases/config/GetAppConfigUseCase";
import { transactionTypes } from "@internal/use-cases/transaction/di/transactionTypes";
import { type SignTransactionUseCase } from "@internal/use-cases/transaction/SignTransactionUseCase";

type DefaultSignerXrpConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
};

export class DefaultSignerXrp implements SignerXrp {
  private readonly _container: Container;

  constructor({ dmk, sessionId }: DefaultSignerXrpConstructorArgs) {
    this._container = makeContainer({ dmk, sessionId });
  }

  getAppConfig(options?: AppConfigOptions): GetAppConfigDAReturnType {
    return this._container
      .get<GetAppConfigUseCase>(configTypes.GetAppConfigUseCase)
      .execute(options);
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
