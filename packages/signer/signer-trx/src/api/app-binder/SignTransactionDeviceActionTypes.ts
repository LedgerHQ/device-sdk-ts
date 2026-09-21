import { type ContextModule } from "@ledgerhq/context-module";
import {
  type CommandErrorResult,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type AppConfiguration } from "@api/model/AppConfiguration";
import { type Signature } from "@api/model/Signature";
import { type TronAddressBook } from "@api/model/TronAddressBook";
import { type TronAppErrorCodes } from "@internal/app-binder/command/utils/tronApplicationErrors";

export type SignTransactionDAOutput = Signature;

export type SignTransactionDAInput = {
  readonly derivationPath: string;
  readonly transaction: Uint8Array;
  readonly contextModule: ContextModule;
  readonly addressBook: TronAddressBook;
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
  GET_APP_CONFIG = "signer.trx.steps.getAppConfig",
  BUILD_CONTEXT = "signer.trx.steps.buildContext",
  PROVIDE_CONTACT = "signer.trx.steps.provideContact",
  SIGN_TRANSACTION = "signer.trx.steps.signTransaction",
}

export type SignTransactionDAIntermediateValue = {
  requiredUserInteraction: SignTransactionDARequiredInteraction;
  step: SignTransactionDAStep;
};

export type SignTransactionDAInternalState = {
  readonly error: SignTransactionDAError | null;
  readonly appConfig: AppConfiguration | null;
  readonly tokenPayloads: Uint8Array[] | null;
  readonly signature: Signature | null;
};

export type SignTransactionDAReturnType = ExecuteDeviceActionReturnType<
  SignTransactionDAOutput,
  SignTransactionDAError,
  SignTransactionDAIntermediateValue
>;
