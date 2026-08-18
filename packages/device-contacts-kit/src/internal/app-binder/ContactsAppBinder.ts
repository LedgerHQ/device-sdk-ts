import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { type RegisterExternalAddressDAReturnType } from "@api/app-binder/RegisterExternalAddressDeviceActionTypes";
import { type RegisterLedgerAccountDAReturnType } from "@api/app-binder/RegisterLedgerAccountDeviceActionTypes";
import { type RegisterExternalAddressInput } from "@api/model/RegisterExternalAddress";
import { type RegisterLedgerAccountInput } from "@api/model/RegisterLedgerAccount";
import { RegisterExternalAddressDeviceAction } from "@internal/app-binder/device-action/RegisterExternalAddress/RegisterExternalAddressDeviceAction";
import { RegisterLedgerAccountDeviceAction } from "@internal/app-binder/device-action/RegisterLedgerAccount/RegisterLedgerAccountDeviceAction";
import { externalTypes } from "@internal/externalTypes";

/**
 * Constructs and executes Contacts `DeviceAction`s using the injected `dmk`,
 * `sessionId`, and `appName`. Each Address Book operation gets one method here.
 */
@injectable()
export class ContactsAppBinder {
  constructor(
    @inject(externalTypes.Dmk)
    protected readonly dmk: DeviceManagementKit,
    @inject(externalTypes.SessionId)
    protected readonly sessionId: DeviceSessionId,
    @inject(externalTypes.AppName)
    protected readonly appName: string,
  ) {}

  registerExternalAddress(
    input: RegisterExternalAddressInput,
  ): RegisterExternalAddressDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new RegisterExternalAddressDeviceAction({
        input: { ...input, appName: this.appName },
      }),
    });
  }

  registerLedgerAccount(
    input: RegisterLedgerAccountInput,
  ): RegisterLedgerAccountDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new RegisterLedgerAccountDeviceAction({
        input: { ...input, appName: this.appName },
      }),
    });
  }
}
