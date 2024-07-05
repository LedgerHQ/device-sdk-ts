import { inject, injectable } from "inversify";

import { Signature } from "@api/index";
import { AppBindingEth } from "@internal/app-binding/AppBindingEth";
import { appBindingTypes } from "@internal/app-binding/di/appBindingTypes";

@injectable()
export class SignMessageUseCase {
  private _appBinding: AppBindingEth;

  constructor(
    @inject(appBindingTypes.AppBinding)
    appBinding: AppBindingEth,
  ) {
    this._appBinding = appBinding;
  }

  async execute(_derivationPath: string, _message: string): Promise<Signature> {
    // 1- Sign the transaction using the app binding

    this._appBinding;

    return Promise.resolve({} as Signature);
  }
}
