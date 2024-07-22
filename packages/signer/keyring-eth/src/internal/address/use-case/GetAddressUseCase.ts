import { inject, injectable } from "inversify";

import { Address } from "@api/model/Address";
import { AddressOptions } from "@api/model/AddressOptions";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { EthAppBinder } from "@internal/app-binder/EthAppBinder";

@injectable()
export class GetAddressUseCase {
  private _appBinder: EthAppBinder;

  constructor(@inject(appBinderTypes.AppBinding) appBinder: EthAppBinder) {
    this._appBinder = appBinder;
  }

  async execute(
    derivationPath: string,
    options?: AddressOptions,
  ): Promise<Address> {
    return this._appBinder.getAddress({
      derivationPath,
      checkOnDevice: options?.checkOnDevice,
      returnChainCode: options?.returnChainCode,
    });
  }
}
