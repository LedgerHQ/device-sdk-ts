import { type ContextModule } from "@ledgerhq/context-module";
import { type SolanaTransactionContextResultSuccess } from "@ledgerhq/context-module/src/solana/domain/solanaContextTypes.js";
import {
  type DeviceActionState,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type SendCommandInAppDAError,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type AppConfiguration } from "@api/model/AppConfiguration";
import { type Signature } from "@api/model/Signature";
import { type SolanaTransactionOptionalConfig } from "@api/model/SolanaTransactionOptionalConfig";
import { type Transaction } from "@api/model/Transaction";
import { type SolanaAppErrorCodes } from "@internal/app-binder/command/utils/SolanaApplicationErrors";
import { type TxInspectorResult } from "@internal/app-binder/services/TransactionInspector";

export enum SignTransactionDAStateStep {
  OPEN_APP = "signer.sol.steps.openApp",
  GET_APP_CONFIG = "signer.sol.steps.getAppConfig",
  INSPECT_TRANSACTION = "signer.sol.steps.inspectTransaction",
  BUILD_TRANSACTION_CONTEXT = "signer.sol.steps.buildTransactionContext",
  PROVIDE_TRANSACTION_CONTEXT = "signer.sol.steps.provideTransactionContext",
  SIGN_TRANSACTION = "signer.sol.steps.signTransaction",
}

export type SignTransactionDAOutput = Signature;

export type SignTransactionDAInput = {
  readonly derivationPath: string;
  readonly transaction: Transaction;
  readonly transactionOptions?: SolanaTransactionOptionalConfig;
  readonly contextModule: ContextModule;
};

export type SignTransactionDAError =
  | OpenAppDAError
  | SendCommandInAppDAError<SolanaAppErrorCodes>;

type SignTransactionDARequiredInteraction =
  | UserInteractionRequired
  | OpenAppDARequiredInteraction;

export type SignTransactionDAIntermediateValue = {
  requiredUserInteraction: SignTransactionDARequiredInteraction;
  step: SignTransactionDAStateStep;
};

export type SignTransactionDAState = DeviceActionState<
  SignTransactionDAOutput,
  SignTransactionDAError,
  SignTransactionDAIntermediateValue
>;

export type SignTransactionDAInternalState = {
  readonly error: SignTransactionDAError | null;
  readonly signature: Signature | null;
  readonly appConfig: AppConfiguration | null;
  readonly solanaTransactionContext: SolanaTransactionContextResultSuccess | null;
  readonly inspectorResult: TxInspectorResult | null;
};

export type SignTransactionDAReturnType = ExecuteDeviceActionReturnType<
  SignTransactionDAOutput,
  SignTransactionDAError,
  SignTransactionDAIntermediateValue
>;
