import { ContainerModule } from "inversify";

import { ContactsContextLoader } from "@/modules/ethereum/contacts/domain/ContactsContextLoader";
import { type ContactsDataSource } from "@/modules/ethereum/contacts/domain/ContactsDataSource";

import { contactsTypes } from "./contactsTypes";

export const contactsModuleFactory = (
  customContactsDataSource: ContactsDataSource | undefined,
) =>
  new ContainerModule(({ bind }) => {
    // Contacts is local-first: there is no default (HTTP / on-disk)
    // data source — if the SDK consumer hasn't injected one via
    // `ContextModuleBuilder.setContactsDataSource`, the loader is
    // simply not registered (gated in `DefaultContextModule`).
    if (customContactsDataSource) {
      bind(contactsTypes.ContactsDataSource).toConstantValue(
        customContactsDataSource,
      );
      bind(contactsTypes.ContactsContextLoader).to(ContactsContextLoader);
    }
  });
