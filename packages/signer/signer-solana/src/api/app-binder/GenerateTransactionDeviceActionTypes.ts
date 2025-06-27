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

export type GenerateTransactionDAOutput = string;

export type GenerateTransactionDAInput = {
  readonly derivationPath: string;
  readonly skipOpenApp: boolean;
  readonly contextModule: ContextModule;
};

export type GenerateTransactionDAError =
  | OpenAppDAError
  | SendCommandInAppDAError<SolanaAppErrorCodes>;

type GenerateTransactionDARequiredInteraction =
  | UserInteractionRequired
  | OpenAppDARequiredInteraction;

export type GenerateTransactionDAIntermediateValue = {
  requiredUserInteraction: GenerateTransactionDARequiredInteraction;
};

export type GenerateTransactionDAState = DeviceActionState<
  GenerateTransactionDAOutput,
  GenerateTransactionDAError,
  GenerateTransactionDAIntermediateValue
>;

export type GenerateTransactionDAInternalState = {
  readonly error: GenerateTransactionDAError | null;
  readonly publicKey: PublicKey | null;
  readonly serialisedTransaction: string | null;
};

export type GenerateTransactionDAReturnType = ExecuteDeviceActionReturnType<
  GenerateTransactionDAOutput,
  GenerateTransactionDAError,
  GenerateTransactionDAIntermediateValue
>;
