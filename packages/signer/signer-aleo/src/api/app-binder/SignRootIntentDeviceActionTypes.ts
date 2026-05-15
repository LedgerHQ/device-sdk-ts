import { type ContextModule } from "@ledgerhq/context-module";
import { type AleoTransactionContextResult } from "@ledgerhq/context-module";
import {
  type CommandErrorResult,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type SignRootIntentCommandResponse } from "@internal/app-binder/command/SignRootIntentCommand";
import { type AleoErrorCodes } from "@internal/app-binder/command/utils/aleoApplicationErrors";

export type SignRootIntentDAOutput = SignRootIntentCommandResponse;

export type SignRootIntentDAError =
  | OpenAppDAError
  | CommandErrorResult<AleoErrorCodes>["error"];

type SignRootIntentDARequiredInteraction =
  | OpenAppDARequiredInteraction
  | UserInteractionRequired.SignTransaction;

export type SignRootIntentDAIntermediateValue = {
  requiredUserInteraction: SignRootIntentDARequiredInteraction;
};

export type SignRootIntentDAInput = {
  derivationPath: string;
  rootIntent: Uint8Array;
  skipOpenApp: boolean;
  tokenInternalId?: string;
  programName?: string;
  contextModule?: ContextModule;
};

export type SignRootIntentDAInternalState = {
  error: SignRootIntentDAError | null;
  signature: SignRootIntentCommandResponse | null;
  aleoTransactionContext: AleoTransactionContextResult | null;
};

export type SignRootIntentDAReturnType = ExecuteDeviceActionReturnType<
  SignRootIntentDAOutput,
  SignRootIntentDAError,
  SignRootIntentDAIntermediateValue
>;
