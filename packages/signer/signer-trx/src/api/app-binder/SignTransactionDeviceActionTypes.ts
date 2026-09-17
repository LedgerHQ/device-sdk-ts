import { type ContextModule } from "@ledgerhq/context-module";
import {
  type CommandErrorResult,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";
import { type TronAppErrorCodes } from "@internal/app-binder/command/utils/tronApplicationErrors";

export type SignTransactionDAOutput = Signature;

export type SignTransactionDAInput = {
  readonly derivationPath: string;
  readonly transaction: Uint8Array;
  readonly contextModule: ContextModule;
  readonly skipOpenApp: boolean;
};

export type SignTransactionDAError =
  | OpenAppDAError
  | CommandErrorResult<TronAppErrorCodes>["error"];

type SignTransactionDARequiredInteraction =
  | OpenAppDARequiredInteraction
  | UserInteractionRequired.None
  | UserInteractionRequired.SignTransaction;

export enum SignTransactionDAStep {
  OPEN_APP = "signer.trx.steps.openApp",
  BUILD_CONTEXT = "signer.trx.steps.buildContext",
  SIGN_TRANSACTION = "signer.trx.steps.signTransaction",
}

export type SignTransactionDAIntermediateValue = {
  requiredUserInteraction: SignTransactionDARequiredInteraction;
  step: SignTransactionDAStep;
};

export type SignTransactionDAInternalState = {
  readonly error: SignTransactionDAError | null;
  readonly tokenPayloads: Uint8Array[] | null;
  readonly signature: Signature | null;
};

export type SignTransactionDAReturnType = ExecuteDeviceActionReturnType<
  SignTransactionDAOutput,
  SignTransactionDAError,
  SignTransactionDAIntermediateValue
>;
