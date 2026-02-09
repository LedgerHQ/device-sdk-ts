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
import { type SolanaSigningContextInfo } from "@internal/app-binder/services/computeSigningContext";
import { type TxInspectorResult } from "@internal/app-binder/services/TransactionInspector";

export type { SolanaSigningContextInfo } from "@internal/app-binder/services/computeSigningContext";
export { BlindSignReason } from "@internal/app-binder/services/computeSigningContext";

export const signTransactionDAStateSteps = Object.freeze({
  OPEN_APP: "signer.sol.steps.openApp",
  GET_APP_CONFIG: "signer.sol.steps.getAppConfig",
  INSPECT_TRANSACTION: "signer.sol.steps.inspectTransaction",
  BUILD_TRANSACTION_CONTEXT: "signer.sol.steps.buildTransactionContext",
  PROVIDE_TRANSACTION_CONTEXT: "signer.sol.steps.provideTransactionContext",
  SIGN_TRANSACTION: "signer.sol.steps.signTransaction",
} as const);

export type SignTransactionDAStateStep =
  (typeof signTransactionDAStateSteps)[keyof typeof signTransactionDAStateSteps];

export type SignTransactionDAOutput = Signature;

export type SignTransactionDAInput = {
  readonly derivationPath: string;
  readonly transaction: Transaction;
  readonly contextModule: ContextModule;
  readonly transactionOptions?: SolanaTransactionOptionalConfig;
};

export type SignTransactionDAError =
  | OpenAppDAError
  | SendCommandInAppDAError<SolanaAppErrorCodes>;

type SignTransactionDARequiredInteraction =
  | UserInteractionRequired
  | OpenAppDARequiredInteraction;

export type SignTransactionDAIntermediateValue =
  | {
      requiredUserInteraction: SignTransactionDARequiredInteraction;
      step: Exclude<
        SignTransactionDAStateStep,
        typeof signTransactionDAStateSteps.SIGN_TRANSACTION
      >;
    }
  | {
      requiredUserInteraction: SignTransactionDARequiredInteraction;
      step: typeof signTransactionDAStateSteps.SIGN_TRANSACTION;
      signingContext: SolanaSigningContextInfo;
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
  readonly signingContextInfo: SolanaSigningContextInfo | null;
  readonly signatureId: string;
};

export type SignTransactionDAReturnType = ExecuteDeviceActionReturnType<
  SignTransactionDAOutput,
  SignTransactionDAError,
  SignTransactionDAIntermediateValue
>;
