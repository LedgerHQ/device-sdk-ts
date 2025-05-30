import { ContainerModule } from "inversify";

import { addressTypes } from "@internal/address/di/addressTypes";
import { GetAddressUseCase } from "@internal/address/use-case/GetAddressUseCase";

export const addressModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(addressTypes.GetAddressUseCase).to(GetAddressUseCase);
  });
