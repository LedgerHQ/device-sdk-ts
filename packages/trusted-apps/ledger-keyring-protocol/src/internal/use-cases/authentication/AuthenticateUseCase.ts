import {
  DeviceActionStatus,
  DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";
import { of } from "rxjs";

import { AuthenticateDAReturnType } from "@api/app-binder/AuthenticateDeviceActionTypes";
import { KeyPair } from "@api/crypto/KeyPair";
import { LKRPMissingDataError } from "@api/model/Errors";
import { Permissions } from "@api/model/Permissions";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { LedgerKeyringProtocolBinder } from "@internal/app-binder/LedgerKeyringProtocolBinder";

export type AuthenticateUsecaseInput = {
  keypair: KeyPair;
  clientName: string;
  permissions: Permissions;
} & (
  | { trustchainId: string; sessionId?: DeviceSessionId }
  | { trustchainId?: undefined; sessionId: DeviceSessionId }
);

@injectable()
export class AuthenticateUseCase {
  constructor(
    @inject(appBinderTypes.AppBinding)
    private appBinder: LedgerKeyringProtocolBinder,
  ) {}

  execute(input: AuthenticateUsecaseInput): AuthenticateDAReturnType {
    if (input.trustchainId) {
      return this.appBinder.authenticateWithKeypair(input);
    }

    const sessionId = input.sessionId;
    if (sessionId) {
      return this.appBinder.authenticateWithDevice({ ...input, sessionId });
    }

    // The AuthenticateUsecaseInput type should prevent this case
    return {
      observable: of({
        status: DeviceActionStatus.Error,
        error: new LKRPMissingDataError(
          "Either a trustchainId or a device is required for authentication.",
        ),
      }),
      cancel: () => undefined,
    };
  }
}
