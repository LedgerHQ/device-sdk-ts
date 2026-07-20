import { ContainerModule } from "inversify";

import { addressTypes } from "@internal/use-cases/address/di/addressTypes";
import { GetAddressUseCase } from "@internal/use-cases/address/GetAddressUseCase";

export const addressModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(addressTypes.GetAddressUseCase).to(GetAddressUseCase);
  });
