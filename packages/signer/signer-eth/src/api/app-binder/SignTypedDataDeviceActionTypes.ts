import { type ContextModule } from "@ledgerhq/context-module";
import {
  type CommandErrorResult,
  type DeviceActionState,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type GetConfigCommandResponse } from "@api/app-binder/GetConfigCommandTypes";
import { type Signature } from "@api/model/Signature";
import { type TypedData } from "@api/model/TypedData";
import { type EthErrorCodes } from "@internal/app-binder/command/utils/ethAppErrors";
import type { ProvideEIP712ContextTaskArgs } from "@internal/app-binder/task/ProvideEIP712ContextTask";
import { type TransactionMapperService } from "@internal/transaction/service/mapper/TransactionMapperService";
import { type TransactionParserService } from "@internal/transaction/service/parser/TransactionParserService";
import { type TypedDataParserService } from "@internal/typed-data/service/TypedDataParserService";

export enum SignTypedDataDAStateStep {
  OPEN_APP = "signer.eth.steps.openApp",
  GET_APP_CONFIG = "signer.eth.steps.getAppConfig",
  GET_ADDRESS = "signer.eth.steps.getAddress",
  WEB3_CHECKS_OPT_IN = "signer.eth.steps.web3ChecksOptIn",
  WEB3_CHECKS_OPT_IN_RESULT = "signer.eth.steps.web3ChecksOptInResult",
  BUILD_CONTEXT = "signer.eth.steps.buildContext",
  PROVIDE_CONTEXT = "signer.eth.steps.provideContext",
  PROVIDE_GENERIC_CONTEXT = "signer.eth.steps.provideGenericContext",
  SIGN_TYPED_DATA = "signer.eth.steps.signTypedData",
  SIGN_TYPED_DATA_LEGACY = "signer.eth.steps.signTypedDataLegacy",
}

export type TypedDataSigningContextInfo = {
  readonly isBlindSign: boolean;
  readonly chainId: number | undefined;
  readonly verifyingContract: string | undefined;
};

export type SignTypedDataDAOutput = Signature;

export type SignTypedDataDAInput = {
  readonly derivationPath: string;
  readonly data: TypedData;
  readonly parser: TypedDataParserService;
  readonly transactionMapper: TransactionMapperService;
  readonly transactionParser: TransactionParserService;
  readonly contextModule: ContextModule;
  readonly skipOpenApp: boolean;
};

export type SignTypedDataDAError =
  | OpenAppDAError
  | CommandErrorResult<EthErrorCodes>["error"];

type SignTypedDataDARequiredInteraction =
  | OpenAppDARequiredInteraction
  | UserInteractionRequired.Web3ChecksOptIn
  | UserInteractionRequired.SignTypedData;

export type SignTypedDataDAIntermediateValue =
  | {
      requiredUserInteraction: SignTypedDataDARequiredInteraction;
      step: Exclude<
        SignTypedDataDAStateStep,
        | SignTypedDataDAStateStep.WEB3_CHECKS_OPT_IN_RESULT
        | SignTypedDataDAStateStep.SIGN_TYPED_DATA
        | SignTypedDataDAStateStep.SIGN_TYPED_DATA_LEGACY
      >;
    }
  | {
      requiredUserInteraction: UserInteractionRequired.None;
      step: SignTypedDataDAStateStep.WEB3_CHECKS_OPT_IN_RESULT;
      result: boolean;
    }
  | {
      requiredUserInteraction: UserInteractionRequired.SignTypedData;
      step: SignTypedDataDAStateStep.SIGN_TYPED_DATA;
      signingContext: TypedDataSigningContextInfo;
    }
  | {
      requiredUserInteraction: UserInteractionRequired.SignTypedData;
      step: SignTypedDataDAStateStep.SIGN_TYPED_DATA_LEGACY;
      signingContext: TypedDataSigningContextInfo;
      fallbackErrorCode: string | undefined;
    };

export type SignTypedDataDAState = DeviceActionState<
  SignTypedDataDAOutput,
  SignTypedDataDAError,
  SignTypedDataDAIntermediateValue
>;

export type SignTypedDataDAInternalState = {
  readonly error: SignTypedDataDAError | null;
  readonly appConfig: GetConfigCommandResponse | null;
  readonly from: string | null;
  readonly typedDataContext: ProvideEIP712ContextTaskArgs | null;
  readonly signature: Signature | null;
  readonly typedDataSigningContextInfo: TypedDataSigningContextInfo | null;
};

export type SignTypedDataDAReturnType = ExecuteDeviceActionReturnType<
  SignTypedDataDAOutput,
  SignTypedDataDAError,
  SignTypedDataDAIntermediateValue
>;
