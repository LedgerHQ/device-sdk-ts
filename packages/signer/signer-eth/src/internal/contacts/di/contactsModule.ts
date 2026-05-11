import { ContainerModule } from "inversify";

import { EditExternalAddressUseCase } from "@internal/contacts/use-case/EditExternalAddressUseCase";
import { RegisterExternalAddressUseCase } from "@internal/contacts/use-case/RegisterExternalAddressUseCase";

import { contactsTypes } from "./contactsTypes";

export const contactsModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(contactsTypes.RegisterExternalAddressUseCase).to(
      RegisterExternalAddressUseCase,
    );
    bind(contactsTypes.EditExternalAddressUseCase).to(
      EditExternalAddressUseCase,
    );
  });
