import {
  type DeviceActionState,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type SendCommandInAppDAError,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";
import { type UserInputType } from "@api/model/TransactionResolutionContext";
import { type SolanaAppErrorCodes } from "@internal/app-binder/command/utils/SolanaApplicationErrors";
import { type BlockhashService } from "@internal/app-binder/services/BlockhashService";

export const signingOperationsDAStateSteps = Object.freeze({
  ZERO_BLOCKHASH: "signer.sol.steps.zeroBlockhash",
  PREVIEW_TRANSACTION: "signer.sol.steps.previewTransaction",
  FETCH_BLOCKHASH: "signer.sol.steps.fetchBlockhash",
  PATCH_TRANSACTION: "signer.sol.steps.patchTransaction",
  DELAYED_SIGN: "signer.sol.steps.delayedSign",
  SIGN_TRANSACTION: "signer.sol.steps.signTransaction",
  FALLBACK_TO_NON_DELAYED_SIGN: "signer.sol.steps.fallbackToNonDelayedSign",
} as const);

export type SigningOperationsDAStateStep =
  (typeof signingOperationsDAStateSteps)[keyof typeof signingOperationsDAStateSteps];

export type SigningOperationsDAOutput = Signature;

export type SigningOperationsDAInput = {
  readonly derivationPath: string;
  readonly transaction: Uint8Array;
  readonly rpcUrl?: string;
  readonly fetchBlockhash?: () => Promise<Uint8Array>;
  readonly userInputType?: UserInputType;
  readonly blockhashService?: BlockhashService;
  // When the device fingerprint is already armed (e.g. by generic clear-sign's
  // PROMPT UI DISPLAY), skip the SIGN MESSAGE PREVIEW step and go straight to
  // the blockhash refresh + SIGN MESSAGE DELAYED. Without a blockhash source the
  // original transaction is signed as-is.
  readonly alreadyArmed?: boolean;
};

export type SigningOperationsDAError =
  | OpenAppDAError
  | SendCommandInAppDAError<SolanaAppErrorCodes>;

type SigningOperationsDARequiredInteraction =
  | UserInteractionRequired
  | OpenAppDARequiredInteraction;

export type SigningOperationsDAIntermediateValue = {
  requiredUserInteraction: SigningOperationsDARequiredInteraction;
  step: SigningOperationsDAStateStep;
};

export type SigningOperationsDAState = DeviceActionState<
  SigningOperationsDAOutput,
  SigningOperationsDAError,
  SigningOperationsDAIntermediateValue
>;

export type SigningOperationsDAInternalState = {
  readonly error: SigningOperationsDAError | null;
  readonly signature: Signature | null;
  readonly zeroedTransaction: Uint8Array | null;
  readonly freshBlockhash: Uint8Array | null;
  readonly patchedTransaction: Uint8Array | null;
  readonly previewFallback: boolean;
};

export type SigningOperationsDAReturnType = ExecuteDeviceActionReturnType<
  SigningOperationsDAOutput,
  SigningOperationsDAError,
  SigningOperationsDAIntermediateValue
>;
