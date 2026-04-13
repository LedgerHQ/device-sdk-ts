import { ContainerModule } from "inversify";

import { credentialDeploymentTypes } from "@internal/use-cases/credential-deployment/di/credentialDeploymentTypes";
import { SignCredentialDeploymentTransactionUseCase } from "@internal/use-cases/credential-deployment/SignCredentialDeploymentTransactionUseCase";

export const credentialDeploymentModuleFactory = () =>
  new ContainerModule(({ bind }) => {
    bind(
      credentialDeploymentTypes.SignCredentialDeploymentTransactionUseCase,
    ).to(SignCredentialDeploymentTransactionUseCase);
  });
