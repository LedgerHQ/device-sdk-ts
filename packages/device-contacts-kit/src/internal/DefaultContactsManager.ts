import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { type Container } from "inversify";

import { type RegisterExternalAddressDAReturnType } from "@api/app-binder/RegisterExternalAddressDeviceActionTypes";
import { type ContactsManager } from "@api/ContactsManager";
import { type RegisterExternalAddressInput } from "@api/model/RegisterExternalAddress";
import { makeContainer } from "@internal/di";
import { useCaseTypes } from "@internal/use-cases/di/useCaseTypes";
import { type RegisterExternalAddressUseCase } from "@internal/use-cases/RegisterExternalAddressUseCase";

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

  registerExternalAddress(
    input: RegisterExternalAddressInput,
  ): RegisterExternalAddressDAReturnType {
    return this._container
      .get<RegisterExternalAddressUseCase>(
        useCaseTypes.RegisterExternalAddressUseCase,
      )
      .execute(input);
  }

  /**
   * Exposes the DI container so future operation methods can resolve their
   * `UseCase`. Not part of the public API.
   */
  protected get container(): Container {
    return this._container;
  }
}
