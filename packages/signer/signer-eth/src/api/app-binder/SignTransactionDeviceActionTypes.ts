import {
  type ContextModule,
  type TransactionSubset,
} from "@ledgerhq/context-module";
import {
  type CommandErrorResult,
  type DeviceActionState,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type GetConfigCommandResponse } from "@api/app-binder/GetConfigCommandTypes";
import { type ClearSigningType } from "@api/model/ClearSigningType";
import { type Signature } from "@api/model/Signature";
import { type TransactionOptions } from "@api/model/TransactionOptions";
import { type TransactionType } from "@api/model/TransactionType";
import { type EthErrorCodes } from "@internal/app-binder/command/utils/ethAppErrors";
import { type ContextWithSubContexts } from "@internal/app-binder/task/BuildFullContextsTask";
import { type TransactionMapperService } from "@internal/transaction/service/mapper/TransactionMapperService";
import { type TransactionParserService } from "@internal/transaction/service/parser/TransactionParserService";

export enum SignTransactionDAStep {
  OPEN_APP = "signer.eth.steps.openApp",
  GET_APP_CONFIG = "signer.eth.steps.getAppConfig",
  GET_ADDRESS = "signer.eth.steps.getAddress",
  WEB3_CHECKS_OPT_IN = "signer.eth.steps.web3ChecksOptIn",
  WEB3_CHECKS_OPT_IN_RESULT = "signer.eth.steps.web3ChecksOptInResult",
  PARSE_TRANSACTION = "signer.eth.steps.parseTransaction",
  BUILD_CONTEXTS = "signer.eth.steps.buildContexts",
  PROVIDE_CONTEXTS = "signer.eth.steps.provideContexts",
  SIGN_TRANSACTION = "signer.eth.steps.signTransaction",
  BLIND_SIGN_TRANSACTION_FALLBACK = "signer.eth.steps.blindSignTransactionFallback",
}

export type SigningContextInfo = {
  readonly signatureId: string;
  readonly clearSigningType: ClearSigningType;
  readonly chainId: number;
  readonly contractAddress: string | undefined;
  readonly isBlindSign: boolean;
  readonly partialContextErrors: number;
};

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
  | UserInteractionRequired.Web3ChecksOptIn
  | UserInteractionRequired.SignTransaction;

export type SignTransactionDAIntermediateValue =
  | {
      requiredUserInteraction: SignTransactionDARequiredInteraction;
      step: Exclude<
        SignTransactionDAStep,
        | SignTransactionDAStep.WEB3_CHECKS_OPT_IN_RESULT
        | SignTransactionDAStep.SIGN_TRANSACTION
        | SignTransactionDAStep.BLIND_SIGN_TRANSACTION_FALLBACK
      >;
    }
  | {
      requiredUserInteraction: UserInteractionRequired.None;
      step: SignTransactionDAStep.WEB3_CHECKS_OPT_IN_RESULT;
      result: boolean;
    }
  | {
      requiredUserInteraction: UserInteractionRequired.SignTransaction;
      step: SignTransactionDAStep.SIGN_TRANSACTION;
      signingContext: SigningContextInfo;
    }
  | {
      requiredUserInteraction: UserInteractionRequired.SignTransaction;
      step: SignTransactionDAStep.BLIND_SIGN_TRANSACTION_FALLBACK;
      signingContext: SigningContextInfo;
      fallbackErrorCode: string | undefined;
    };

export type SignTransactionDAState = DeviceActionState<
  SignTransactionDAOutput,
  SignTransactionDAError,
  SignTransactionDAIntermediateValue
>;

export type SignTransactionDAInternalState = {
  readonly error: SignTransactionDAError | null;
  readonly appConfig: GetConfigCommandResponse | null;
  readonly subset: TransactionSubset | null;
  readonly contexts: ContextWithSubContexts[];
  readonly clearSigningType: ClearSigningType | null;
  readonly transactionType: TransactionType | null;
  readonly signature: Signature | null;
  readonly signingContextInfo: SigningContextInfo | null;
  readonly partialContextErrors: number;
  readonly signatureId: string;
};

export type SignTransactionDAReturnType = ExecuteDeviceActionReturnType<
  SignTransactionDAOutput,
  SignTransactionDAError,
  SignTransactionDAIntermediateValue
>;
