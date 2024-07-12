import { inject, injectable } from "inversify";

import { Address, AddressOptions } from "@api/index";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { EthAppBinder } from "@internal/app-binder/EthAppBinder";

@injectable()
export class GetAddressUseCase {
  private _appBinder: EthAppBinder;

  constructor(@inject(appBinderTypes.AppBinding) appBinder: EthAppBinder) {
    this._appBinder = appBinder;
  }

  async execute(
    _derivationPath: string,
    _options?: AddressOptions,
  ): Promise<Address> {
    // 1- Get the address using the app binder

    this._appBinder;

    return Promise.resolve({} as Address);
  }
}
