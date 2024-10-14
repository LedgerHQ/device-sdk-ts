import {
  ClearSignContextSuccess,
  ContextModule,
} from "@ledgerhq/context-module";
import {
  type CommandErrorResult,
  type DeviceActionState,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { Signature } from "@api/model/Signature";
import { Transaction } from "@api/model/Transaction";
import { TransactionOptions } from "@api/model/TransactionOptions";
import { ProvideTransactionContextTaskErrorCodes } from "@internal/app-binder/task/ProvideTransactionContextTask";
import { TransactionMapperService } from "@internal/transaction/service/mapper/TransactionMapperService";

export type SignTransactionDAOutput = Signature;

export type SignTransactionDAInput = {
  readonly derivationPath: string;
  readonly transaction: Transaction;
  readonly mapper: TransactionMapperService;
  readonly contextModule: ContextModule;
  readonly options: TransactionOptions;
};

export type SignTransactionDAError =
  | OpenAppDAError
  | CommandErrorResult["error"]
  | CommandErrorResult<ProvideTransactionContextTaskErrorCodes>["error"];

type SignTransactionDARequiredInteraction =
  | OpenAppDARequiredInteraction
  | UserInteractionRequired.SignTransaction;

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
  readonly challenge: string | null;
  readonly clearSignContexts: ClearSignContextSuccess[] | null;
  readonly serializedTransaction: Uint8Array | null;
  readonly signature: Signature | null;
};

export type SignTransactionDAReturnType = ExecuteDeviceActionReturnType<
  SignTransactionDAOutput,
  SignTransactionDAError,
  SignTransactionDAIntermediateValue
>;
