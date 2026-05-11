import { ContainerModule } from "inversify";

import { EditExternalAddressUseCase } from "@internal/contacts/use-case/EditExternalAddressUseCase";
import { ProvideContactUseCase } from "@internal/contacts/use-case/ProvideContactUseCase";
import { ProvideLedgerAccountUseCase } from "@internal/contacts/use-case/ProvideLedgerAccountUseCase";
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
    bind(contactsTypes.ProvideContactUseCase).to(ProvideContactUseCase);
    bind(contactsTypes.ProvideLedgerAccountUseCase).to(
      ProvideLedgerAccountUseCase,
    );
  });
