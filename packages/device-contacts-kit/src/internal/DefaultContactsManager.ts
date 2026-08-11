import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { type Container } from "inversify";

import { type ContactsManager } from "@api/ContactsManager";
import { makeContainer } from "@internal/di";

type DefaultContactsManagerConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
  appName: string;
};

export class DefaultContactsManager implements ContactsManager {
  private readonly _container: Container;

  constructor({
    dmk,
    sessionId,
    appName,
  }: DefaultContactsManagerConstructorArgs) {
    this._container = makeContainer({ dmk, sessionId, appName });
  }

  /**
   * Exposes the DI container so operation methods (added by their dedicated
   * tickets) can resolve their `UseCase`. Not part of the public API.
   */
  protected get container(): Container {
    return this._container;
  }
}
