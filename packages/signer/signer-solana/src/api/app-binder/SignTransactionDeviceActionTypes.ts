import { type ContextModule } from "@ledgerhq/context-module";
import { type SolanaTransactionContextResultSuccess } from "@ledgerhq/context-module/src/solana/domain/solanaContextTypes.js";
import {
  type DeviceActionState,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type SendCommandInAppDAError,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type AppConfiguration } from "@api/model/AppConfiguration";
import { type Signature } from "@api/model/Signature";
import { type Transaction } from "@api/model/Transaction";
import { type SolanaAppErrorCodes } from "@internal/app-binder/command/utils/SolanaApplicationErrors";
import { type TxInspectorResult } from "@internal/app-binder/services/TransactionInspector";

export type SignTransactionDAOutput = Signature;

export type SignTransactionDAInput = {
  readonly derivationPath: string;
  readonly transaction: Transaction;
  readonly skipOpenApp: boolean;
  readonly contextModule: ContextModule;
};

export type SignTransactionDAError =
  | OpenAppDAError
  | SendCommandInAppDAError<SolanaAppErrorCodes>;

type SignTransactionDARequiredInteraction = UserInteractionRequired | "OpenApp";

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
  readonly appConfig: AppConfiguration | null;
  readonly solanaTransactionContext: SolanaTransactionContextResultSuccess | null;
  readonly inspectorResult: TxInspectorResult | null;
};

export type SignTransactionDAReturnType = ExecuteDeviceActionReturnType<
  SignTransactionDAOutput,
  SignTransactionDAError,
  SignTransactionDAIntermediateValue
>;
