import { ContainerModule } from "inversify";

import { DisplaySafeAccountUseCase } from "@internal/safe/use-case/DisplaySafeAccountUseCase";

import { safeTypes } from "./safeTypes";

export const safeModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(safeTypes.DisplaySafeAccountUseCase).to(DisplaySafeAccountUseCase);
  });
