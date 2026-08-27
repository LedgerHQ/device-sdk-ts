import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { type RegisterExternalAddressDAReturnType } from "@api/app-binder/RegisterExternalAddressDeviceActionTypes";
import { type RegisterExternalAddressInput } from "@api/model/RegisterExternalAddress";
import { RegisterExternalAddressDeviceAction } from "@internal/app-binder/device-action/RegisterExternalAddress/RegisterExternalAddressDeviceAction";
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
}
