import { ContainerModule } from "inversify";

import { ContactsAppBinder } from "@internal/contacts/app-binder/ContactsAppBinder";
import { RenameContactUseCase } from "@internal/contacts/use-case/RenameContactUseCase";

import { contactsTypes } from "./contactsTypes";

export const contactsModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(contactsTypes.ContactsAppBinder).to(ContactsAppBinder);
    bind(contactsTypes.RenameContactUseCase).to(RenameContactUseCase);
  });
