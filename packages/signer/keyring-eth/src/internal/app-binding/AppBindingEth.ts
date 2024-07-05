import { DeviceSdk } from "@ledgerhq/device-sdk-core";
import { inject, injectable } from "inversify";

import { externalTypes } from "@internal/externalTypes";

@injectable()
export class AppBindingEth {
  private _sdk: DeviceSdk;

  constructor(@inject(externalTypes.Sdk) sdk: DeviceSdk) {
    this._sdk = sdk;
    this._sdk; // TODO: remove this line
  }
}
