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
 * (`SignGenericClearSignDeviceAction` and `SignBasicClearSignDeviceAction`).
 * The blockhash refresh runs host-side via `RefreshBlockhashTask` and surfaces
 * as the single `FETCH_BLOCKHASH` step.
 */
export const signClearSignDAStateSteps = Object.freeze({
  ZERO_BLOCKHASH: "signer.sol.steps.zeroBlockhash",
  PREVIEW_TRANSACTION: "signer.sol.steps.previewTransaction",
  FETCH_BLOCKHASH: "signer.sol.steps.fetchBlockhash",
  PROMPT_UI_DISPLAY: "signer.sol.steps.promptUiDisplay",
  DELAYED_SIGN: "signer.sol.steps.delayedSign",
  SIGN_TRANSACTION: "signer.sol.steps.signTransaction",
  FALLBACK_TO_NON_DELAYED_SIGN: "signer.sol.steps.fallbackToNonDelayedSign",
} as const);

export type SignClearSignDAStateStep =
  (typeof signClearSignDAStateSteps)[keyof typeof signClearSignDAStateSteps];

/**
 * Input shared by both terminal signing machines. The blockhash source
 * (`rpcUrl` / `fetchBlockhash`) is only populated by the caller when a delayed
 * blockhash refresh is allowed; when withheld, the original transaction is
 * signed as-is.
 */
export type SignClearSignDAInput = {
  readonly derivationPath: string;
  readonly transaction: Uint8Array;
  readonly rpcUrl?: string;
  readonly fetchBlockhash?: () => Promise<Uint8Array>;
  readonly userInputType?: UserInputType;
  readonly blockhashService?: BlockhashService;
};

export type SignClearSignDAError =
  | OpenAppDAError
  | SendCommandInAppDAError<SolanaAppErrorCodes>;

type SignClearSignDARequiredInteraction =
  | UserInteractionRequired
  | OpenAppDARequiredInteraction;

export type SignClearSignDAIntermediateValue = {
  requiredUserInteraction: SignClearSignDARequiredInteraction;
  step: SignClearSignDAStateStep;
};
