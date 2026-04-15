import { type DeviceSessionId } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { type LedgerIdentityDAReturnType } from "@api/app-binder/LedgerIdentityDeviceActionTypes";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { type LedgerKeyringProtocolBinder } from "@internal/app-binder/LedgerKeyringProtocolBinder";

@injectable()
export class LedgerIdentityEncryptUseCase {
  constructor(
    @inject(appBinderTypes.AppBinding)
    private appBinder: LedgerKeyringProtocolBinder,
  ) {}

  execute(input: {
    intent: string;
    blob: Uint8Array;
    sessionId: DeviceSessionId;
  }): LedgerIdentityDAReturnType {
    return this.appBinder.ledgerIdentityEncrypt(input);
  }
}
