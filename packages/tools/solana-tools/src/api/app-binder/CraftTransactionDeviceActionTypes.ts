import {
  type DeviceActionState,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type SendCommandInAppDAError,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";
import { type SolanaAppErrorCodes } from "@ledgerhq/device-signer-kit-solana";

export type CraftTransactionDAOutput = string;

export type CraftTransactionDAInput = {
  readonly derivationPath: string;
  readonly serialisedTransaction: string;
  readonly skipOpenApp: boolean;
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
  readonly publicKey: string | null;
  readonly serialisedTransaction: string | null;
};

export type CraftTransactionDAReturnType = ExecuteDeviceActionReturnType<
  CraftTransactionDAOutput,
  CraftTransactionDAError,
  CraftTransactionDAIntermediateValue
>;
