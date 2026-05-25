import { type ContextModule } from "@ledgerhq/context-module";
import {
  type DeviceActionState,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type SendCommandInAppDAError,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type SuiSignature } from "@api/model/SuiSignature";
import { type SuiAppErrorCodes } from "@internal/app-binder/command/utils/SuiAppErrors";
import { type DescriptorInput } from "@internal/app-binder/task/ProvideTrustedDynamicDescriptorTask";

export const signTransactionDAStateSteps = Object.freeze({
  OPEN_APP: "signer.sui.steps.openApp",
  PROVIDE_DESCRIPTOR: "signer.sui.steps.provideDescriptor",
  SIGN_TRANSACTION: "signer.sui.steps.signTransaction",
} as const);

export type SignTransactionDAStateStep =
  (typeof signTransactionDAStateSteps)[keyof typeof signTransactionDAStateSteps];

export type SignTransactionDAOutput = SuiSignature;

export type SignTransactionDAInput = {
  readonly derivationPath: string;
  readonly transaction: Uint8Array;
  readonly objectData?: Uint8Array[];
  readonly descriptor?: DescriptorInput;
  readonly contextModule: ContextModule;
  readonly skipOpenApp: boolean;
};

export type SignTransactionDAError =
  | OpenAppDAError
  | SendCommandInAppDAError<SuiAppErrorCodes>;

type SignTransactionDARequiredInteraction =
  | UserInteractionRequired
  | OpenAppDARequiredInteraction;

export type SignTransactionDAIntermediateValue = {
  requiredUserInteraction: SignTransactionDARequiredInteraction;
  step: SignTransactionDAStateStep;
};

export type SignTransactionDAState = DeviceActionState<
  SignTransactionDAOutput,
  SignTransactionDAError,
  SignTransactionDAIntermediateValue
>;

export type SignTransactionDAInternalState = {
  readonly error: SignTransactionDAError | null;
  readonly signature: SuiSignature | null;
};

export type SignTransactionDAReturnType = ExecuteDeviceActionReturnType<
  SignTransactionDAOutput,
  SignTransactionDAError,
  SignTransactionDAIntermediateValue
>;
