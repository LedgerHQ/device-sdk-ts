import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { inject, injectable } from "inversify";

import { externalTypes } from "@internal/externalTypes";

/**
 * Constructs and executes Contacts `DeviceAction`s using the injected `dmk`,
 * `sessionId`, and `appName`. Operation methods (one per Address Book
 * management command) are added by their dedicated implementation tickets and
 * consume these members.
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
}
