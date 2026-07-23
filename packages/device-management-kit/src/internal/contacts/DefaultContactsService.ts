import { type Container } from "inversify";

import { type EditExternalAddressLabelDAReturnType } from "@api/contacts/app-binder/EditExternalAddressLabelDeviceActionTypes";
import { type RenameContactDAReturnType } from "@api/contacts/app-binder/RenameContactDeviceActionTypes";
import { type ContactsService } from "@api/contacts/ContactsService";
import { type EditExternalAddressLabelArgs } from "@api/contacts/model/EditExternalAddressLabelArgs";
import { type RenameContactArgs } from "@api/contacts/model/RenameContactArgs";
import { type DeviceSessionId } from "@api/device-session/types";
import { type DeviceManagementKit } from "@api/DeviceManagementKit";
import { makeContactsContainer } from "@internal/contacts/di";
import { contactsTypes } from "@internal/contacts/di/contactsTypes";
import { type EditExternalAddressLabelUseCase } from "@internal/contacts/use-case/EditExternalAddressLabelUseCase";
import { type RenameContactUseCase } from "@internal/contacts/use-case/RenameContactUseCase";

type DefaultContactsServiceConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
};

export class DefaultContactsService implements ContactsService {
  private _container: Container;

  constructor({ dmk, sessionId }: DefaultContactsServiceConstructorArgs) {
    this._container = makeContactsContainer({ dmk, sessionId });
  }

  renameContact(args: RenameContactArgs): RenameContactDAReturnType {
    return this._container
      .get<RenameContactUseCase>(contactsTypes.RenameContactUseCase)
      .execute(args);
  }

  editExternalAddressLabel(
    args: EditExternalAddressLabelArgs,
  ): EditExternalAddressLabelDAReturnType {
    return this._container
      .get<EditExternalAddressLabelUseCase>(
        contactsTypes.EditExternalAddressLabelUseCase,
      )
      .execute(args);
  }
}
