import { type ContextModule } from "@ledgerhq/context-module";
import {
  type CommandErrorResult,
  type DeviceActionState,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

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

export type SignTypedDataDAError = OpenAppDAError | CommandErrorResult["error"];

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
