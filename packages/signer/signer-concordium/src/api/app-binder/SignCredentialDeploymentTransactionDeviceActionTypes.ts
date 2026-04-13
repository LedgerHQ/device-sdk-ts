import {
  type CommandErrorResult,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type SendCommandInAppDAOutput,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type SignCredentialDeploymentCommandResponse } from "@internal/app-binder/command/SignCredentialDeploymentCommand";
import { type ConcordiumErrorCodes } from "@internal/app-binder/command/utils/ConcordiumApplicationErrors";

export type SignCredentialDeploymentTransactionDAOutput =
  SendCommandInAppDAOutput<SignCredentialDeploymentCommandResponse>;
export type SignCredentialDeploymentTransactionDAError =
  | OpenAppDAError
  | CommandErrorResult<ConcordiumErrorCodes>["error"];

type SignCredentialDeploymentTransactionDARequiredInteraction =
  | OpenAppDARequiredInteraction
  | UserInteractionRequired.SignTransaction;

export type SignCredentialDeploymentTransactionDAIntermediateValue = {
  requiredUserInteraction: SignCredentialDeploymentTransactionDARequiredInteraction;
};

export type SignCredentialDeploymentTransactionDAReturnType =
  ExecuteDeviceActionReturnType<
    SignCredentialDeploymentTransactionDAOutput,
    SignCredentialDeploymentTransactionDAError,
    SignCredentialDeploymentTransactionDAIntermediateValue
  >;
