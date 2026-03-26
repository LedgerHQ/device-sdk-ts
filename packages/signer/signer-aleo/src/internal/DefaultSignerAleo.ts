import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { type Container } from "inversify";

import { type GetAddressDAReturnType } from "@api/app-binder/GetAddressDeviceActionTypes";
import { type GetAppConfigDAReturnType } from "@api/app-binder/GetAppConfigDeviceActionTypes";
import { type GetViewKeyDAReturnType } from "@api/app-binder/GetViewKeyDeviceActionTypes";
import { type SignFeeIntentDAReturnType } from "@api/app-binder/SignFeeIntentDeviceActionTypes";
import { type SignRootIntentDAReturnType } from "@api/app-binder/SignRootIntentDeviceActionTypes";
import { type AddressOptions } from "@api/model/AddressOptions";
import { type TransactionOptions } from "@api/model/TransactionOptions";
import { type SignerAleo } from "@api/SignerAleo";
import { makeContainer } from "@internal/di";
import { addressTypes } from "@internal/use-cases/address/di/addressTypes";
import { type GetAddressUseCase } from "@internal/use-cases/address/GetAddressUseCase";
import { type GetViewKeyUseCase } from "@internal/use-cases/address/GetViewKeyUseCase";
import { configTypes } from "@internal/use-cases/config/di/configTypes";
import { type GetAppConfigUseCase } from "@internal/use-cases/config/GetAppConfigUseCase";
import { transactionTypes } from "@internal/use-cases/transaction/di/transactionTypes";
import { type SignFeeIntentUseCase } from "@internal/use-cases/transaction/SignFeeIntentUseCase";
import { type SignRootIntentUseCase } from "@internal/use-cases/transaction/SignRootIntentUseCase";

type DefaultSignerAleoConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
};

export class DefaultSignerAleo implements SignerAleo {
  private readonly _container: Container;

  constructor({ dmk, sessionId }: DefaultSignerAleoConstructorArgs) {
    this._container = makeContainer({ dmk, sessionId });
  }

  getAppConfig(): GetAppConfigDAReturnType {
    return this._container
      .get<GetAppConfigUseCase>(configTypes.GetAppConfigUseCase)
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

  getViewKey(
    derivationPath: string,
    options?: AddressOptions,
  ): GetViewKeyDAReturnType {
    return this._container
      .get<GetViewKeyUseCase>(addressTypes.GetViewKeyUseCase)
      .execute(derivationPath, options);
  }

  signRootIntent(
    derivationPath: string,
    rootIntent: Uint8Array,
    options?: TransactionOptions,
  ): SignRootIntentDAReturnType {
    return this._container
      .get<SignRootIntentUseCase>(transactionTypes.SignRootIntentUseCase)
      .execute(derivationPath, rootIntent, options);
  }

  signFeeIntent(
    feeIntent: Uint8Array,
    options?: TransactionOptions,
  ): SignFeeIntentDAReturnType {
    return this._container
      .get<SignFeeIntentUseCase>(transactionTypes.SignFeeIntentUseCase)
      .execute(feeIntent, options);
  }
}
