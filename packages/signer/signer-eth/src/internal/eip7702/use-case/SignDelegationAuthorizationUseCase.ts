import { inject, injectable } from "inversify";

import { SignDelegationAuthorizationDAReturnType } from "@api/app-binder/SignDelegationAuthorizationTypes";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { EthAppBinder } from "@internal/app-binder/EthAppBinder";

@injectable()
export class SignDelegationAuthorizationUseCase {
  private _appBinder: EthAppBinder;

  constructor(
    @inject(appBinderTypes.AppBinding)
    appBinding: EthAppBinder,
  ) {
    this._appBinder = appBinding;
  }

  execute(
    derivationPath: string,
    nonce: number,
    address: string,
    chainId: number,
  ): SignDelegationAuthorizationDAReturnType {
    return this._appBinder.signDelegationAuthorization({
      derivationPath,
      nonce,
      address,
      chainId,
    });
  }
}
