import { type DeviceManagementKit } from "@api/DeviceManagementKit";
import { type DeviceSessionId } from "@api/device-session/types";

import { type ContactsService } from "@api/contacts/ContactsService";
import { DefaultContactsService } from "@internal/contacts/DefaultContactsService";

type ContactsServiceBuilderConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
};

/**
 * Builder for the `ContactsService`.
 *
 * @example
 * ```ts
 * const contactsService = new ContactsServiceBuilder({ dmk, sessionId }).build();
 * await contactsService.renameContact({ oldName, newName, ... });
 * ```
 */
export class ContactsServiceBuilder {
  private _dmk: DeviceManagementKit;
  private _sessionId: DeviceSessionId;

  constructor({ dmk, sessionId }: ContactsServiceBuilderConstructorArgs) {
    this._dmk = dmk;
    this._sessionId = sessionId;
  }

  public build(): ContactsService {
    return new DefaultContactsService({
      dmk: this._dmk,
      sessionId: this._sessionId,
    });
  }
}
