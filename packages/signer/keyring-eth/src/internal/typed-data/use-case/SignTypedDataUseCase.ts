import { DeviceSdk } from "@ledgerhq/device-sdk-core";
import { inject, injectable } from "inversify";

import { Signature, TypedData } from "@api/index";
import { externalTypes } from "@internal/externalTypes";

@injectable()
export class SignTypedDataUseCase {
  private _sdk: DeviceSdk;

  constructor(
    @inject(externalTypes.Sdk)
    sdk: DeviceSdk,
  ) {
    this._sdk = sdk;
  }

  async execute(
    _derivationPath: string,
    _typedData: TypedData,
  ): Promise<Signature> {
    // 1- Sign the transaction using the app binding

    this._sdk;

    return Promise.resolve({} as Signature);
  }
}
