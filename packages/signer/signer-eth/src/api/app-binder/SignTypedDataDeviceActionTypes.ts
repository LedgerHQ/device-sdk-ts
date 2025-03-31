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
import { type TypedDataParserService } from "@internal/typed-data/service/TypedDataParserService";

export enum SignTypedDataDAStateStep {
  OPEN_APP = "signer.eth.steps.openApp",
  GET_APP_CONFIG = "signer.eth.steps.getAppConfig",
  WEB3_CHECKS_OPT_IN = "signer.eth.steps.web3ChecksOptIn",
  BUILD_CONTEXT = "signer.eth.steps.buildContext",
  PROVIDE_CONTEXT = "signer.eth.steps.provideContext",
  PROVIDE_GENERIC_CONTEXT = "signer.eth.steps.provideGenericContext",
  SIGN_TYPED_DATA = "signer.eth.steps.signTypedData",
  SIGN_TYPED_DATA_LEGACY = "signer.eth.steps.signTypedDataLegacy",
}

export type SignTypedDataDAOutput = Signature;

export type SignTypedDataDAInput = {
  readonly derivationPath: string;
  readonly data: TypedData;
  readonly parser: TypedDataParserService;
  readonly contextModule: ContextModule;
};

export type SignTypedDataDAError =
  | OpenAppDAError
  | CommandErrorResult<EthErrorCodes>["error"];

type SignTypedDataDARequiredInteraction =
  | OpenAppDARequiredInteraction
  | UserInteractionRequired.Web3ChecksOptIn
  | UserInteractionRequired.SignTypedData;

export type SignTypedDataDAIntermediateValue = {
  requiredUserInteraction: SignTypedDataDARequiredInteraction;
  step: SignTypedDataDAStateStep;
};

export type SignTypedDataDAState = DeviceActionState<
  SignTypedDataDAOutput,
  SignTypedDataDAError,
  SignTypedDataDAIntermediateValue
>;

export type SignTypedDataDAInternalState = {
  readonly error: SignTypedDataDAError | null;
  readonly appConfig: GetConfigCommandResponse | null;
  readonly typedDataContext: ProvideEIP712ContextTaskArgs | null;
  readonly signature: Signature | null;
};

export type SignTypedDataDAReturnType = ExecuteDeviceActionReturnType<
  SignTypedDataDAOutput,
  SignTypedDataDAError,
  SignTypedDataDAIntermediateValue
>;
