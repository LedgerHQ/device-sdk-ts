import { ContainerModule } from "inversify";

import { EditExternalAddressUseCase } from "@internal/contacts/use-case/EditExternalAddressUseCase";
import { EditLedgerAccountUseCase } from "@internal/contacts/use-case/EditLedgerAccountUseCase";
import { RegisterExternalAddressUseCase } from "@internal/contacts/use-case/RegisterExternalAddressUseCase";
import { RegisterLedgerAccountUseCase } from "@internal/contacts/use-case/RegisterLedgerAccountUseCase";

import { contactsTypes } from "./contactsTypes";

export const contactsModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(contactsTypes.RegisterExternalAddressUseCase).to(
      RegisterExternalAddressUseCase,
    );
    bind(contactsTypes.EditExternalAddressUseCase).to(
      EditExternalAddressUseCase,
    );
    bind(contactsTypes.RegisterLedgerAccountUseCase).to(
      RegisterLedgerAccountUseCase,
    );
    bind(contactsTypes.EditLedgerAccountUseCase).to(EditLedgerAccountUseCase);
  });
