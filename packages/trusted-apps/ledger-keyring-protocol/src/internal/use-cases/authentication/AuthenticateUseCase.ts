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
import { LedgerKeyRingProtocolBinder } from "@internal/app-binder/LedgerKeyRingProtocolBinder";

export type AuthenticateUsecaseInput = {
  keyPair: KeyPair;
  clientName: string;
  permissions: Permissions;
} & (
  | { LedgerKeyRingProtocolId: string; sessionId?: DeviceSessionId }
  | { LedgerKeyRingProtocolId?: undefined; sessionId: DeviceSessionId }
);

@injectable()
export class AuthenticateUseCase {
  constructor(
    @inject(appBinderTypes.AppBinding)
    private appBinder: LedgerKeyRingProtocolBinder,
  ) {}

  execute(input: AuthenticateUsecaseInput): AuthenticateDAReturnType {
    if (input.LedgerKeyRingProtocolId) {
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
          "Either a LedgerKeyRingProtocolId or a device is required for authentication.",
        ),
      }),
      cancel: () => undefined,
    };
  }
}
