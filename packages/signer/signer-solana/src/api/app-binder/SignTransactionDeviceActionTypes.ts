import {
  type ContextModule,
  type SolanaTransactionContextResultSuccess,
} from "@ledgerhq/context-module";
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
import { type BlockhashService } from "@internal/app-binder/services/BlockhashService";
import { type TxInspectorResult } from "@internal/app-binder/services/TransactionInspector";

import { type DelayedSignDAStateStep } from "./DelayedSignTransactionDeviceActionTypes";

export const signTransactionDAStateSteps = Object.freeze({
  OPEN_APP: "signer.sol.steps.openApp",
  GET_APP_CONFIG: "signer.sol.steps.getAppConfig",
  WEB3_CHECKS_OPT_IN: "signer.sol.steps.web3ChecksOptIn",
  WEB3_CHECKS_OPT_IN_RESULT: "signer.sol.steps.web3ChecksOptInResult",
  ZERO_BLOCKHASH: "signer.sol.steps.zeroBlockhash",
  INSPECT_TRANSACTION: "signer.sol.steps.inspectTransaction",
  GET_PUB_KEY: "signer.sol.steps.getPubKey",
  BUILD_TRANSACTION_CONTEXT: "signer.sol.steps.buildTransactionContext",
  PROVIDE_TRANSACTION_CONTEXT: "signer.sol.steps.provideTransactionContext",
  SIGN_TRANSACTION: "signer.sol.steps.signTransaction",
  DELAYED_SIGN: "signer.sol.steps.delayedSign",
} as const);

export type SignTransactionDAStateStep =
  | (typeof signTransactionDAStateSteps)[keyof typeof signTransactionDAStateSteps]
  | DelayedSignDAStateStep;

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

export type SignTransactionDAIntermediateValue =
  | {
      requiredUserInteraction: SignTransactionDARequiredInteraction;
      step: Exclude<
        SignTransactionDAStateStep,
        typeof signTransactionDAStateSteps.WEB3_CHECKS_OPT_IN_RESULT
      >;
    }
  | {
      requiredUserInteraction: UserInteractionRequired.None;
      step: typeof signTransactionDAStateSteps.WEB3_CHECKS_OPT_IN_RESULT;
      result: boolean;
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
  readonly signerAddress: string | null;
  readonly zeroedTransaction: Uint8Array | null;
};

export type SignTransactionDAReturnType = ExecuteDeviceActionReturnType<
  SignTransactionDAOutput,
  SignTransactionDAError,
  SignTransactionDAIntermediateValue
>;
