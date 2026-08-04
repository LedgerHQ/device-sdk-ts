import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";

import { type ContactsManager } from "@api/ContactsManager";
import { DefaultContactsManager } from "@internal/DefaultContactsManager";

type ContactsManagerBuilderConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
  appName: string;
};

/**
 * Builder for the `ContactsManager`.
 *
 * @example
 * ```
 * const contactsManager = new ContactsManagerBuilder({ dmk, sessionId, appName })
 *  .build();
 * ```
 */
export class ContactsManagerBuilder {
  private readonly _dmk: DeviceManagementKit;
  private readonly _sessionId: DeviceSessionId;
  private readonly _appName: string;

  constructor({
    dmk,
    sessionId,
    appName,
  }: ContactsManagerBuilderConstructorArgs) {
    this._dmk = dmk;
    this._sessionId = sessionId;
    this._appName = appName;
  }

  /**
   * Build the Contacts manager instance.
   *
   * @returns the Contacts manager instance
   */
  public build(): ContactsManager {
    return new DefaultContactsManager({
      dmk: this._dmk,
      sessionId: this._sessionId,
      appName: this._appName,
    });
  }
}
