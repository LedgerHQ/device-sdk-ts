import { inject, injectable } from "inversify";

import { Address, AddressOptions } from "@api/index";
import { AppBindingEth } from "@internal/app-binding/AppBindingEth";
import { appBindingTypes } from "@internal/app-binding/di/appBindingTypes";

@injectable()
export class GetAddressUseCase {
  private _appBinding: AppBindingEth;

  constructor(@inject(appBindingTypes.AppBinding) appBinding: AppBindingEth) {
    this._appBinding = appBinding;
  }

  async execute(
    _derivationPath: string,
    _options?: AddressOptions,
  ): Promise<Address> {
    // 1- Get the address using the app binding

    this._appBinding;

    return Promise.resolve({} as Address);
  }
}
