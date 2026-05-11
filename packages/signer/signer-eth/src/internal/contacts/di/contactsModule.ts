import { ContainerModule } from "inversify";

import { RegisterExternalAddressUseCase } from "@internal/contacts/use-case/RegisterExternalAddressUseCase";

import { contactsTypes } from "./contactsTypes";

export const contactsModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(contactsTypes.RegisterExternalAddressUseCase).to(
      RegisterExternalAddressUseCase,
    );
  });
