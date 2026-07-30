import { ContainerModule } from "inversify";

import { addressTypes } from "@internal/use-cases/address/di/addressTypes";
import { GetAddressUseCase } from "@internal/use-cases/address/GetAddressUseCase";
import { GetFullViewingKeyUseCase } from "@internal/use-cases/address/GetFullViewingKeyUseCase";
import { GetShieldedAddressUseCase } from "@internal/use-cases/address/GetShieldedAddressUseCase";

export const addressModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(addressTypes.GetAddressUseCase).to(GetAddressUseCase);
    bind(addressTypes.GetFullViewingKeyUseCase).to(GetFullViewingKeyUseCase);
    bind(addressTypes.GetShieldedAddressUseCase).to(GetShieldedAddressUseCase);
  });
