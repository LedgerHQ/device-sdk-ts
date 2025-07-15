import { inject, injectable } from "inversify";

import { AuthenticateDAReturnType } from "@api/app-binder/AuthenticateDeviceActionTypes";
import { JWT, Keypair } from "@api/app-binder/LKRPTypes";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { LedgerKeyringProtocolBinder } from "@internal/app-binder/LedgerKeyringProtocolBinder";

@injectable()
export class AuthenticateUseCase {
  constructor(
    @inject(appBinderTypes.AppBinding)
    private appBinder: LedgerKeyringProtocolBinder,
  ) {}

  execute(
    keypair: Keypair,
    applicationId: number,
    trustchainId?: string,
    jwt?: JWT,
  ): AuthenticateDAReturnType {
    return this.appBinder.authenticate({
      keypair,
      applicationId,
      trustchainId,
      jwt,
    });
  }
}
