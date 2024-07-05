import { inject, injectable } from "inversify";

import { Signature, TypedData } from "@api/index";
import { AppBindingEth } from "@internal/app-binding/AppBindingEth";
import { appBindingTypes } from "@internal/app-binding/di/appBindingTypes";

@injectable()
export class SignTypedDataUseCase {
  private _appBinding: AppBindingEth;

  constructor(@inject(appBindingTypes.AppBinding) appBinding: AppBindingEth) {
    this._appBinding = appBinding;
  }

  async execute(
    _derivationPath: string,
    _typedData: TypedData,
  ): Promise<Signature> {
    // 1- Sign the transaction using the app binding

    this._appBinding;

    return Promise.resolve({} as Signature);
  }
}
