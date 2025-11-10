import { type ContextModule } from "@ledgerhq/context-module";
import {
  type DeviceActionState,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type SendCommandInAppDAError,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type PublicKey } from "@api/model/PublicKey";
import { type SolanaAppErrorCodes } from "@internal/app-binder/command/utils/SolanaApplicationErrors";

export type SwapTransactionSignerDAOutput = string;

export type SwapTransactionSignerDAInput = {
  readonly derivationPath: string;
  readonly serialisedTransaction: string;
  readonly skipOpenApp: boolean;
  readonly contextModule: ContextModule;
};

export type SwapTransactionSignerDAError =
  | OpenAppDAError
  | SendCommandInAppDAError<SolanaAppErrorCodes>;

type SwapTransactionSignerDARequiredInteraction =
  | UserInteractionRequired
  | OpenAppDARequiredInteraction;

export type SwapTransactionSignerDAIntermediateValue = {
  requiredUserInteraction: SwapTransactionSignerDARequiredInteraction;
};

export type SwapTransactionSignerDAState = DeviceActionState<
  SwapTransactionSignerDAOutput,
  SwapTransactionSignerDAError,
  SwapTransactionSignerDAIntermediateValue
>;

export type SwapTransactionSignerDAInternalState = {
  readonly error: SwapTransactionSignerDAError | null;
  readonly publicKey: PublicKey | null;
  readonly serialisedTransaction: string | null;
};

export type SwapTransactionSignerDAReturnType = ExecuteDeviceActionReturnType<
  SwapTransactionSignerDAOutput,
  SwapTransactionSignerDAError,
  SwapTransactionSignerDAIntermediateValue
>;
