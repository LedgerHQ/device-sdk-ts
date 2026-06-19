import {
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type SendCommandInAppDAError,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type UserInputType } from "@api/model/TransactionResolutionContext";
import { type SolanaAppErrorCodes } from "@internal/app-binder/command/utils/SolanaApplicationErrors";
import { type BlockhashService } from "@internal/app-binder/services/BlockhashService";

/**
 * Steps shared by the two terminal signing machines
 * (`SignGenericClearSignDeviceAction` and
 * `SignBasicClearSignDeviceAction`) and the shared
 * `RefreshBlockhashDeviceAction` child.
 */
export const signingOperationsDAStateSteps = Object.freeze({
  ZERO_BLOCKHASH: "signer.sol.steps.zeroBlockhash",
  PREVIEW_TRANSACTION: "signer.sol.steps.previewTransaction",
  FETCH_BLOCKHASH: "signer.sol.steps.fetchBlockhash",
  PATCH_TRANSACTION: "signer.sol.steps.patchTransaction",
  PROMPT_UI_DISPLAY: "signer.sol.steps.promptUiDisplay",
  DELAYED_SIGN: "signer.sol.steps.delayedSign",
  SIGN_TRANSACTION: "signer.sol.steps.signTransaction",
  FALLBACK_TO_NON_DELAYED_SIGN: "signer.sol.steps.fallbackToNonDelayedSign",
} as const);

export type SigningOperationsDAStateStep =
  (typeof signingOperationsDAStateSteps)[keyof typeof signingOperationsDAStateSteps];

/**
 * Input shared by both terminal signing machines. The blockhash source
 * (`rpcUrl` / `fetchBlockhash`) is only populated by the caller when a delayed
 * blockhash refresh is allowed; when withheld, the original transaction is
 * signed as-is.
 */
export type SigningOperationsDAInput = {
  readonly derivationPath: string;
  readonly transaction: Uint8Array;
  readonly rpcUrl?: string;
  readonly fetchBlockhash?: () => Promise<Uint8Array>;
  readonly userInputType?: UserInputType;
  readonly blockhashService?: BlockhashService;
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
