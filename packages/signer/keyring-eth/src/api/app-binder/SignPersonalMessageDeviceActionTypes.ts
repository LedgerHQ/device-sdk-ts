import {
  CommandErrorResult,
  DeviceActionState,
  ExecuteDeviceActionReturnType,
  OpenAppDAError,
  OpenAppDARequiredInteraction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { Signature } from "@api/model/Signature";

export type SignPersonalMessageDAOutput = Signature;

export type SignPersonalMessageDAInput = {
  readonly derivationPath: string;
  readonly message: string;
};

export type SignPersonalMessageDAError =
  | OpenAppDAError
  | CommandErrorResult["error"];

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
