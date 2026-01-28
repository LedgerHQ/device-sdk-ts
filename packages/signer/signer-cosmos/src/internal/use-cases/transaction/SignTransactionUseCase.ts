import { inject, injectable } from "inversify";

import { SignTransactionDAReturnType } from "@api/app-binder/SignTransactionDeviceActionTypes";
import { TransactionOptions } from "@api/model/TransactionOptions";
import { CosmosAppBinder } from "@internal/app-binder/CosmosAppBinder";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";

@injectable()
export class SignTransactionUseCase {
  constructor(
    @inject(appBinderTypes.AppBinder) private appBinder: CosmosAppBinder,
  ) {}

  execute(
    derivationPath: string,
    serializedSignDoc: Uint8Array,
    options?: TransactionOptions,
  ): SignTransactionDAReturnType {
    return this.appBinder.signTransaction({
      derivationPath,
      serializedSignDoc,
      options,
    });
  }
}
