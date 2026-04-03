import { inject, injectable } from "inversify";

import { type SignCredentialDeploymentTransactionDAReturnType } from "@api/app-binder/SignCredentialDeploymentTransactionDeviceActionTypes";
import { type TransactionOptions } from "@api/model/TransactionOptions";
import { ConcordiumAppBinder } from "@internal/app-binder/ConcordiumAppBinder";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";

@injectable()
export class SignCredentialDeploymentTransactionUseCase {
  private readonly _appBinder: ConcordiumAppBinder;

  constructor(
    @inject(appBinderTypes.AppBinding) appBinder: ConcordiumAppBinder,
  ) {
    this._appBinder = appBinder;
  }

  execute(
    derivationPath: string,
    transaction: Uint8Array,
    options?: TransactionOptions,
  ): SignCredentialDeploymentTransactionDAReturnType {
    return this._appBinder.signCredentialDeploymentTransaction({
      derivationPath,
      transaction,
      skipOpenApp: options?.skipOpenApp,
    });
  }
}
