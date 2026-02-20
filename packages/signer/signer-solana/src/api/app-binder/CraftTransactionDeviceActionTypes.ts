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

export type CraftTransactionDAOutput = string;

export type CraftTransactionDAInput = {
  readonly derivationPath: string;
  readonly serialisedTransaction: string;
  readonly skipOpenApp: boolean;
  readonly contextModule: ContextModule;
};

export type CraftTransactionDAError =
  | OpenAppDAError
  | SendCommandInAppDAError<SolanaAppErrorCodes>;

type CraftTransactionDARequiredInteraction =
  | UserInteractionRequired
  | OpenAppDARequiredInteraction;

export type CraftTransactionDAIntermediateValue = {
  requiredUserInteraction: CraftTransactionDARequiredInteraction;
};

export type CraftTransactionDAState = DeviceActionState<
  CraftTransactionDAOutput,
  CraftTransactionDAError,
  CraftTransactionDAIntermediateValue
>;

export type CraftTransactionDAInternalState = {
  readonly error: CraftTransactionDAError | null;
  readonly publicKey: PublicKey | null;
  readonly serialisedTransaction: string | null;
};

export type CraftTransactionDAReturnType = ExecuteDeviceActionReturnType<
  CraftTransactionDAOutput,
  CraftTransactionDAError,
  CraftTransactionDAIntermediateValue
>;
