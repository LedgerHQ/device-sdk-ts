import { inject, injectable } from "inversify";

import { Signature } from "@api/model/Signature";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { EthAppBinder } from "@internal/app-binder/EthAppBinder";

@injectable()
export class SignMessageUseCase {
  private _appBinding: EthAppBinder;

  constructor(
    @inject(appBinderTypes.AppBinding)
    appBinding: EthAppBinder,
  ) {
    this._appBinding = appBinding;
  }

  async execute(_derivationPath: string, _message: string): Promise<Signature> {
    // 1- Sign the transaction using the app binding

    this._appBinding;

    return Promise.resolve({} as Signature);
  }
}
