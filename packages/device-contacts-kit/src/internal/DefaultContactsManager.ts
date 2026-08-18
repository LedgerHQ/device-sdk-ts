import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { type Container } from "inversify";

import { type RegisterExternalAddressDAReturnType } from "@api/app-binder/RegisterExternalAddressDeviceActionTypes";
import { type RegisterLedgerAccountDAReturnType } from "@api/app-binder/RegisterLedgerAccountDeviceActionTypes";
import { type ContactsManager } from "@api/ContactsManager";
import { type RegisterExternalAddressInput } from "@api/model/RegisterExternalAddress";
import { type RegisterLedgerAccountInput } from "@api/model/RegisterLedgerAccount";
import { makeContainer } from "@internal/di";
import { useCaseTypes } from "@internal/use-cases/di/useCaseTypes";
import { type RegisterExternalAddressUseCase } from "@internal/use-cases/RegisterExternalAddressUseCase";
import { type RegisterLedgerAccountUseCase } from "@internal/use-cases/RegisterLedgerAccountUseCase";

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

  registerLedgerAccount(
    input: RegisterLedgerAccountInput,
  ): RegisterLedgerAccountDAReturnType {
    return this._container
      .get<RegisterLedgerAccountUseCase>(
        useCaseTypes.RegisterLedgerAccountUseCase,
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
