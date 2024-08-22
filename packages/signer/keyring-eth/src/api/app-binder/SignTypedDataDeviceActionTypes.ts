import { ContextModule } from "@ledgerhq/context-module";
import {
  CommandErrorResult,
  DeviceActionState,
  ExecuteDeviceActionReturnType,
  OpenAppDAError,
  OpenAppDARequiredInteraction,
  SdkError,
  UserInteractionRequired,
} from "@ledgerhq/device-sdk-core";

import { Signature } from "@api/model/Signature";
import { TypedData } from "@api/model/TypedData";
import type { ProvideEIP712ContextTaskArgs } from "@internal/app-binder/task/ProvideEIP712ContextTask";
import { TypedDataParserService } from "@internal/typed-data/service/TypedDataParserService";

export type SignTypedDataDAOutput = Signature;

export type SignTypedDataDAInput = {
  readonly derivationPath: string;
  readonly data: TypedData;
  readonly parser: TypedDataParserService;
  readonly contextModule: ContextModule;
};

export class SignTypedDataError implements SdkError {
  readonly _tag = "SignTypedDataError";
  readonly originalError?: Error;

  constructor(message?: string) {
    this.originalError = new Error(message ?? "Sign typed data error.");
  }
}

export type SignTypedDataDAError = OpenAppDAError | CommandErrorResult["error"]; /// TODO: remove, we should have an exhaustive list of errors

type SignTypedDataDARequiredInteraction =
  | OpenAppDARequiredInteraction
  | UserInteractionRequired.SignTypedData;

export type SignTypedDataDAIntermediateValue = {
  requiredUserInteraction: SignTypedDataDARequiredInteraction;
};

export type SignTypedDataDAState = DeviceActionState<
  SignTypedDataDAOutput,
  SignTypedDataDAError,
  SignTypedDataDAIntermediateValue
>;

export type SignTypedDataDAInternalState = {
  readonly error: OpenAppDAError | null;
  readonly typedDataContext: ProvideEIP712ContextTaskArgs | null;
  readonly signature: Signature | null;
};

export type SignTypedDataDAReturnType = ExecuteDeviceActionReturnType<
  SignTypedDataDAOutput,
  SignTypedDataDAError,
  SignTypedDataDAIntermediateValue
>;
