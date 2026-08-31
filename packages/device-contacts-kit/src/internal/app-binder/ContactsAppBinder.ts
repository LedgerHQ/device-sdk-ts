import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { type EditExternalAddressIdentifierDAReturnType } from "@api/app-binder/EditExternalAddressIdentifierDeviceActionTypes";
import { type EditExternalAddressScopeDAReturnType } from "@api/app-binder/EditExternalAddressScopeDeviceActionTypes";
import { type RegisterExternalAddressDAReturnType } from "@api/app-binder/RegisterExternalAddressDeviceActionTypes";
import { type RenameContactDAReturnType } from "@api/app-binder/RenameContactDeviceActionTypes";
import { type EditExternalAddressIdentifierInput } from "@api/model/EditExternalAddressIdentifier";
import { type EditExternalAddressScopeInput } from "@api/model/EditExternalAddressScope";
import { type RegisterExternalAddressInput } from "@api/model/RegisterExternalAddress";
import { type RenameContactInput } from "@api/model/RenameContact";
import { EditExternalAddressIdentifierDeviceAction } from "@internal/app-binder/device-action/EditExternalAddressIdentifier/EditExternalAddressIdentifierDeviceAction";
import { EditExternalAddressScopeDeviceAction } from "@internal/app-binder/device-action/EditExternalAddressScope/EditExternalAddressScopeDeviceAction";
import { RegisterExternalAddressDeviceAction } from "@internal/app-binder/device-action/RegisterExternalAddress/RegisterExternalAddressDeviceAction";
import { RenameContactDeviceAction } from "@internal/app-binder/device-action/RenameContact/RenameContactDeviceAction";
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

  renameContact(input: RenameContactInput): RenameContactDAReturnType {
    // Rename is a dashboard operation: `appName` is intentionally not passed —
    // the OS serves the command and there is no app to open.
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new RenameContactDeviceAction({ input }),
    });
  }

  editExternalAddressIdentifier(
    input: EditExternalAddressIdentifierInput,
  ): EditExternalAddressIdentifierDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new EditExternalAddressIdentifierDeviceAction({
        input: { ...input, appName: this.appName },
      }),
    });
  }

  editExternalAddressScope(
    input: EditExternalAddressScopeInput,
  ): EditExternalAddressScopeDAReturnType {
    return this.dmk.executeDeviceAction({
      sessionId: this.sessionId,
      deviceAction: new EditExternalAddressScopeDeviceAction({
        input: { ...input, appName: this.appName },
      }),
    });
  }
}
