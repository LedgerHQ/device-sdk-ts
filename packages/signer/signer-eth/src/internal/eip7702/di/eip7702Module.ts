import { ContainerModule } from "inversify";

import { eip7702Types } from "@internal/eip7702/di/eip7702Types";
import { SignDelegationAuthorizationUseCase } from "@internal/eip7702/use-case/SignDelegationAuthorizationUseCase";

export const eip7702ModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(eip7702Types.SignDelegationAuthorizationUseCase).to(
      SignDelegationAuthorizationUseCase,
    );
  });
