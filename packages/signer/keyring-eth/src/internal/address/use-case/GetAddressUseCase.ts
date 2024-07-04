import { DeviceSdk } from "@ledgerhq/device-sdk-core";
import { inject, injectable } from "inversify";

import { Address, AddressOptions } from "@api/index";
import { externalTypes } from "@internal/externalTypes";

@injectable()
export class GetAddressUseCase {
  private _sdk: DeviceSdk;

  constructor(
    @inject(externalTypes.Sdk)
    sdk: DeviceSdk,
  ) {
    this._sdk = sdk;
  }

  async execute(
    _derivationPath: string,
    _options?: AddressOptions,
  ): Promise<Address> {
    // 1- Get the address using the app binding

    this._sdk;

    return Promise.resolve({} as Address);
  }
}
