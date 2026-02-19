import { ContainerModule } from "inversify";

import { actionsTypes } from "@internal/use-cases/actions/di/actionsTypes";
import { SignActionsUseCase } from "@internal/use-cases/actions/SignActionsUseCase";

export const actionsModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(actionsTypes.SignActionsUseCase).to(SignActionsUseCase);
  });
