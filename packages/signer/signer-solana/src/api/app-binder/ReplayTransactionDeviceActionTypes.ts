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

export type ReplayTransactionDAOutput = string;

export type ReplayTransactionDAInput = {
  readonly derivationPath: string;
  readonly serialisedTransaction: string;
  readonly skipOpenApp: boolean;
  readonly contextModule: ContextModule;
};

export type ReplayTransactionDAError =
  | OpenAppDAError
  | SendCommandInAppDAError<SolanaAppErrorCodes>;

type ReplayTransactionDARequiredInteraction =
  | UserInteractionRequired
  | OpenAppDARequiredInteraction;

export type ReplayTransactionDAIntermediateValue = {
  requiredUserInteraction: ReplayTransactionDARequiredInteraction;
};

export type ReplayTransactionDAState = DeviceActionState<
  ReplayTransactionDAOutput,
  ReplayTransactionDAError,
  ReplayTransactionDAIntermediateValue
>;

export type ReplayTransactionDAInternalState = {
  readonly error: ReplayTransactionDAError | null;
  readonly publicKey: PublicKey | null;
  readonly serialisedTransaction: string | null;
};

export type ReplayTransactionDAReturnType = ExecuteDeviceActionReturnType<
  ReplayTransactionDAOutput,
  ReplayTransactionDAError,
  ReplayTransactionDAIntermediateValue
>;
