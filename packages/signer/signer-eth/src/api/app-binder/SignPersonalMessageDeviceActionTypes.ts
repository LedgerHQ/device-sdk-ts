import {
  type CommandErrorResult,
  type DeviceActionState,
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";
import { type EthErrorCodes } from "@internal/app-binder/command/utils/ethAppErrors";

export type SignPersonalMessageDAOutput = Signature;

export type SignPersonalMessageDAInput = {
  readonly derivationPath: string;
  readonly message: string | Uint8Array;
};

export type SignPersonalMessageDAError =
  | OpenAppDAError
  | CommandErrorResult<EthErrorCodes>["error"];

type SignPersonalMessageDARequiredInteraction =
  | OpenAppDARequiredInteraction
  | UserInteractionRequired.SignPersonalMessage;

export type SignPersonalMessageDAIntermediateValue = {
  requiredUserInteraction: SignPersonalMessageDARequiredInteraction;
};

export type SignPersonalMessageDAState = DeviceActionState<
  SignPersonalMessageDAOutput,
  SignPersonalMessageDAError,
  SignPersonalMessageDAIntermediateValue
>;

export type SignPersonalMessageDAInternalState = {
  readonly error: SignPersonalMessageDAError | null;
  readonly signature: Signature | null;
};

export type SignPersonalMessageDAReturnType = ExecuteDeviceActionReturnType<
  SignPersonalMessageDAOutput,
  SignPersonalMessageDAError,
  SignPersonalMessageDAIntermediateValue
>;
