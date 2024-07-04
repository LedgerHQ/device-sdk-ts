import { DeviceSdk } from "@ledgerhq/device-sdk-core";
import { inject, injectable } from "inversify";

import { Signature } from "@api/index";
import { externalTypes } from "@internal/externalTypes";

@injectable()
export class SignMessageUseCase {
  private _sdk: DeviceSdk;

  constructor(
    @inject(externalTypes.Sdk)
    sdk: DeviceSdk,
  ) {
    this._sdk = sdk;
  }

  async execute(_derivationPath: string, _message: string): Promise<Signature> {
    // 1- Sign the transaction using the app binding

    this._sdk;

    return Promise.resolve({} as Signature);
  }
}
