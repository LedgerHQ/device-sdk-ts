import {
  type ClearSignContextSuccess,
  type ClearSignContextType,
  type ContextModule,
} from "@ledgerhq/context-module";
import {
  type CommandErrorResult,
  type DeviceActionState,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";
import { type TransactionOptions } from "@api/model/TransactionOptions";
import { type TransactionType } from "@api/model/TransactionType";
import { type EthErrorCodes } from "@internal/app-binder/command/utils/ethAppErrors";
import { type GenericContext } from "@internal/app-binder/task/ProvideTransactionGenericContextTask";
import { type TransactionMapperService } from "@internal/transaction/service/mapper/TransactionMapperService";
import { type TransactionParserService } from "@internal/transaction/service/parser/TransactionParserService";

export type SignTransactionDAOutput = Signature;

export type SignTransactionDAInput = {
  readonly derivationPath: string;
  readonly transaction: Uint8Array;
  readonly mapper: TransactionMapperService;
  readonly parser: TransactionParserService;
  readonly contextModule: ContextModule;
  readonly options: TransactionOptions;
};

export type SignTransactionDAError =
  | OpenAppDAError
  | CommandErrorResult<EthErrorCodes>["error"];

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
  readonly clearSignContexts: ClearSignContextSuccess[] | GenericContext | null;
  readonly web3Check: ClearSignContextSuccess<ClearSignContextType.WEB3_CHECK> | null;
  readonly serializedTransaction: Uint8Array | null;
  readonly chainId: number | null;
  readonly transactionType: TransactionType | null;
  readonly isLegacy: boolean;
  readonly signature: Signature | null;
};

export type SignTransactionDAReturnType = ExecuteDeviceActionReturnType<
  SignTransactionDAOutput,
  SignTransactionDAError,
  SignTransactionDAIntermediateValue
>;
