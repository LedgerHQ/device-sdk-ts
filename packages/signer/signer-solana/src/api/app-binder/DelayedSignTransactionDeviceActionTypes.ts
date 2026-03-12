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

export const delayedSignDAStateSteps = Object.freeze({
  ZERO_BLOCKHASH: "signer.sol.steps.zeroBlockhash",
  PREVIEW_TRANSACTION: "signer.sol.steps.previewTransaction",
  FETCH_BLOCKHASH: "signer.sol.steps.fetchBlockhash",
  PATCH_TRANSACTION: "signer.sol.steps.patchTransaction",
  DELAYED_SIGN: "signer.sol.steps.delayedSign",
  FALLBACK_TO_NON_DELAYED_SIGN: "signer.sol.steps.fallbackToNonDelayedSign",
} as const);

export type DelayedSignDAStateStep =
  (typeof delayedSignDAStateSteps)[keyof typeof delayedSignDAStateSteps];

export type DelayedSignDAOutput = Signature;

export type DelayedSignDAInput = {
  readonly derivationPath: string;
  readonly transaction: Uint8Array;
  readonly rpcUrl?: string;
  readonly fetchBlockhash?: () => Promise<Uint8Array>;
  readonly userInputType?: UserInputType;
};

export type DelayedSignDAError =
  | OpenAppDAError
  | SendCommandInAppDAError<SolanaAppErrorCodes>;

type DelayedSignDARequiredInteraction =
  | UserInteractionRequired
  | OpenAppDARequiredInteraction;

export type DelayedSignDAIntermediateValue = {
  requiredUserInteraction: DelayedSignDARequiredInteraction;
  step: DelayedSignDAStateStep;
};

export type DelayedSignDAState = DeviceActionState<
  DelayedSignDAOutput,
  DelayedSignDAError,
  DelayedSignDAIntermediateValue
>;

export type DelayedSignDAInternalState = {
  readonly error: DelayedSignDAError | null;
  readonly signature: Signature | null;
  readonly zeroedTransaction: Uint8Array | null;
  readonly freshBlockhash: Uint8Array | null;
  readonly patchedTransaction: Uint8Array | null;
  readonly previewFallback: boolean;
};

export type DelayedSignDAReturnType = ExecuteDeviceActionReturnType<
  DelayedSignDAOutput,
  DelayedSignDAError,
  DelayedSignDAIntermediateValue
>;
