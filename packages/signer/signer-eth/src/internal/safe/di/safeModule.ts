import { ContainerModule } from "inversify";

import { VerifySafeAddressUseCase } from "@internal/safe/use-case/VerifySafeAddressUseCase";

import { safeTypes } from "./safeTypes";

export const safeModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(safeTypes.VerifySafeAddressUseCase).to(VerifySafeAddressUseCase);
  });
