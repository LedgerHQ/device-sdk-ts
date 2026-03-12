import {
  type CommandErrorResult,
  type DeviceActionState,
  type ExecuteDeviceActionReturnType,
  type LoadCertificateErrorCodes,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type Signature } from "@api/model/Signature";
import { type HyperliquidErrorCodes } from "@internal/app-binder/command/utils/hyperliquidApplicationErrors";
import type { HyperliquidAction } from "@internal/app-binder/di/appBinderTypes";

export const signActionsDAStateSteps = Object.freeze({
  OPEN_APP: "signer.hl.steps.openApp",
  SET_CERTIFICATE: "signer.hl.steps.setCertificate",
  SEND_METADATA: "signer.hl.steps.sendMetadata",
  SEND_ACTION: "signer.hl.steps.sendAction",
  SIGN_ACTIONS: "signer.hl.steps.signActions",
} as const);

export type SignActionsDAStateStep =
  (typeof signActionsDAStateSteps)[keyof typeof signActionsDAStateSteps];

export type SignActionsDAOutput = Signature[];

/** One action to sign (TLV format per specs "Set action to sign") */
export type SignActionsActionItem = HyperliquidAction;

export type SignActionsDAInput = {
  readonly derivationPath: string;
  readonly certificate: Uint8Array;
  readonly signedMetadata: Uint8Array;
  readonly actions: SignActionsActionItem[];
  readonly skipOpenApp?: boolean;
};

export type SignActionsDAError =
  | OpenAppDAError
  | CommandErrorResult<HyperliquidErrorCodes>["error"]
  | CommandErrorResult<LoadCertificateErrorCodes>["error"];

type SignActionsDARequiredInteraction =
  | OpenAppDARequiredInteraction
  | UserInteractionRequired.SignTransaction;

export type SignActionsDAIntermediateValue = {
  requiredUserInteraction: SignActionsDARequiredInteraction;
  step: SignActionsDAStateStep;
};

export type SignActionsDAState = DeviceActionState<
  SignActionsDAOutput,
  SignActionsDAError,
  SignActionsDAIntermediateValue
>;

export type SignActionsDAInternalState = {
  readonly error: SignActionsDAError | null;
  readonly signature: SignActionsDAOutput | null;
  readonly actionIndex: number;
};

export type SignActionsDAReturnType = ExecuteDeviceActionReturnType<
  SignActionsDAOutput,
  SignActionsDAError,
  SignActionsDAIntermediateValue
>;
