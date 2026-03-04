import { ContainerModule } from "inversify";

import { addressTypes } from "@internal/use-cases/address/di/addressTypes";
import { GetAddressUseCase } from "@internal/use-cases/address/GetAddressUseCase";
import { GetViewKeyUseCase } from "@internal/use-cases/address/GetViewKeyUseCase";

export const addressModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(addressTypes.GetAddressUseCase).to(GetAddressUseCase);
    bind(addressTypes.GetViewKeyUseCase).to(GetViewKeyUseCase);
  });
