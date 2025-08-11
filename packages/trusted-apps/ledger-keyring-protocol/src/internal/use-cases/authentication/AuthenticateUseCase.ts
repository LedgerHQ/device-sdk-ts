import { inject, injectable } from "inversify";

import { AuthenticateDAReturnType } from "@api/app-binder/AuthenticateDeviceActionTypes";
import { Keypair, Permissions } from "@api/app-binder/LKRPTypes";
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
    clientName: string,
    permissions: Permissions,
    trustchainId?: string,
  ): AuthenticateDAReturnType {
    return this.appBinder.authenticate({
      keypair,
      clientName,
      permissions,
      trustchainId,
    });
  }
}
