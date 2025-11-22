import {
  type DeviceActionState,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type SendCommandInAppDAError,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";
import { type SignDoc } from "@api/model/SignDoc";
import { type TransactionOptions } from "@api/model/TransactionOptions";
import { type CosmosAppErrorCodes } from "@internal/app-binder/command/utils/CosmosAppErrors";

export type SignTransactionDAOutput = Signature;

export type SignTransactionDAInput = {
  readonly derivationPath: string;
  readonly signDoc: SignDoc;
  readonly options: TransactionOptions;
};

export type SignTransactionDAError =
  | OpenAppDAError
  | SendCommandInAppDAError<CosmosAppErrorCodes>;

type SignTransactionDARequiredInteraction =
  | UserInteractionRequired
  | OpenAppDARequiredInteraction;

export type SignTransactionDAIntermediateValue = {
  requiredUserInteraction: SignTransactionDARequiredInteraction;
};

export type SignTransactionDAState = DeviceActionState<
  SignTransactionDAOutput,
  SignTransactionDAError,
  SignTransactionDAIntermediateValue
>;

export type SignTransactionDAInternalState = {
  readonly error: SignTransactionDAError | null;
  readonly signature: Signature | null;
};

export type SignTransactionDAReturnType = ExecuteDeviceActionReturnType<
  SignTransactionDAOutput,
  SignTransactionDAError,
  SignTransactionDAIntermediateValue
>;
