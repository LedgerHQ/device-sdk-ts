import { type DeviceSessionId } from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { type LedgerProofDAReturnType } from "@api/app-binder/LedgerProofDeviceActionTypes";
import { appBinderTypes } from "@internal/app-binder/di/appBinderTypes";
import { type LedgerKeyringProtocolBinder } from "@internal/app-binder/LedgerKeyringProtocolBinder";

@injectable()
export class LedgerProofEncryptUseCase {
  constructor(
    @inject(appBinderTypes.AppBinding)
    private appBinder: LedgerKeyringProtocolBinder,
  ) {}

  execute(input: {
    intent: string;
    blob: Uint8Array;
    sessionId: DeviceSessionId;
  }): LedgerProofDAReturnType {
    return this.appBinder.ledgerProofEncrypt(input);
  }
}
