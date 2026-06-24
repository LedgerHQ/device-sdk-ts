import { type ContextModule } from "@ledgerhq/context-module";
import {
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
import { type BlockhashService } from "@internal/app-binder/services/BlockhashService";

import { type SigningOperationsDAStateStep } from "./SigningOperationsDeviceActionTypes";

export const signTransactionDAStateSteps = Object.freeze({
  OPEN_APP: "signer.sol.steps.openApp",
  GET_APP_CONFIG: "signer.sol.steps.getAppConfig",
  TRANSACTION_CHECKS_OPT_IN: "signer.sol.steps.transactionChecksOptIn",
  TRANSACTION_CHECKS_OPT_IN_RESULT:
    "signer.sol.steps.transactionChecksOptInResult",
  TRANSACTION_CHECKS_PROVIDE: "signer.sol.steps.transactionChecksProvide",
  INSPECT_TRANSACTION: "signer.sol.steps.inspectTransaction",
  GET_PUB_KEY: "signer.sol.steps.getPubKey",
  BUILD_BASIC_CLEAR_SIGN_CONTEXT: "signer.sol.steps.buildBasicClearSignContext",
  PROVIDE_BASIC_CLEAR_SIGN_CONTEXT:
    "signer.sol.steps.provideBasicClearSignContext",
  BUILD_GENERIC_CLEAR_SIGN_CONTEXT:
    "signer.sol.steps.buildGenericClearSignContext",
  PROVIDE_GENERIC_CLEAR_SIGN_CONTEXT:
    "signer.sol.steps.provideGenericClearSignContext",
  FINALIZE_GENERIC_CLEAR_SIGN: "signer.sol.steps.finalizeGenericClearSign",
  PROMPT_UI_DISPLAY: "signer.sol.steps.promptUiDisplay",
  SIGN_TRANSACTION: "signer.sol.steps.signTransaction",
  DELAYED_SIGN: "signer.sol.steps.delayedSign",
} as const);

/**
 * Which clear-signing path produced the signature.
 * `full` = device ran the merge engine
 * `srfc39-only` = partial CAL coverage, device auto-rendered per-instruction without merge
 * `none` = blind/legacy fallback (no instruction recognised or capability absent).
 */
export type ClearSignMode = "full" | "srfc39-only" | "none";

export type SignTransactionDAStateStep =
  | (typeof signTransactionDAStateSteps)[keyof typeof signTransactionDAStateSteps]
  | SigningOperationsDAStateStep;

export type SignTransactionDAOutput = Signature;

export type SignTransactionDAInput = {
  readonly derivationPath: string;
  readonly transaction: Transaction;
  readonly contextModule: ContextModule;
  readonly transactionOptions?: SolanaTransactionOptionalConfig;
  readonly solanaRPCURL?: string;
  readonly blockhashService?: BlockhashService;
};

export type SignTransactionDAError =
  | OpenAppDAError
  | SendCommandInAppDAError<SolanaAppErrorCodes>;

type SignTransactionDARequiredInteraction =
  | UserInteractionRequired
  | OpenAppDARequiredInteraction;

/**
 * The intermediate value shared by every sign-transaction step except the
 * TRANSACTION_CHECKS_OPT_IN_RESULT branch (which carries an extra `result`). The
 * clear-sign child machines emit exactly this shape, so the parent can fold
 * their snapshots into its own intermediate value without a cast.
 */
export type SignTransactionDASimpleIntermediateValue = {
  requiredUserInteraction: SignTransactionDARequiredInteraction;
  step: Exclude<
    SignTransactionDAStateStep,
    typeof signTransactionDAStateSteps.TRANSACTION_CHECKS_OPT_IN_RESULT
  >;
};

export type SignTransactionDAIntermediateValue =
  | SignTransactionDASimpleIntermediateValue
  | {
      requiredUserInteraction: UserInteractionRequired.None;
      step: typeof signTransactionDAStateSteps.TRANSACTION_CHECKS_OPT_IN_RESULT;
      result: boolean;
    };

export type SignTransactionDAInternalState = {
  readonly error: SignTransactionDAError | null;
  readonly signature: Signature | null;
  readonly appConfig: AppConfiguration | null;
  // Set when the generic clear-sign path streamed + FINALIZE-validated the
  // descriptors, so the terminal sign runs the generic PROMPT UI DISPLAY flow
  // instead of the legacy preview.
  readonly clearSignPrepared: boolean;
};

export type SignTransactionDAReturnType = ExecuteDeviceActionReturnType<
  SignTransactionDAOutput,
  SignTransactionDAError,
  SignTransactionDAIntermediateValue
>;
