import {
  type CommandErrorResult,
  type ExecuteDeviceActionReturnType,
  type LoggerPublisherService,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type Curve } from "@api/model/Curve";
import { type Signature } from "@api/model/Signature";
import { type XrpErrorCodes } from "@internal/app-binder/command/utils/xrpApplicationErrors";

export type SignTransactionDAOutput = Signature;

/**
 * Device-action input. `transaction` is read from invoke / `createActor` input
 * at runtime, so a parent flow can register `makeStateMachine` once and pass
 * the serialized bytes only when they are known (e.g. after GetAddress).
 */
export type SignTransactionDAInput = {
  readonly derivationPath: string;
  readonly transaction: Uint8Array;
  readonly skipOpenApp: boolean;
  readonly curve: Curve;
  readonly loggerFactory: (tag: string) => LoggerPublisherService;
};

export type SignTransactionDAError =
  | OpenAppDAError
  | CommandErrorResult<XrpErrorCodes>["error"];

type SignTransactionDARequiredInteraction =
  | OpenAppDARequiredInteraction
  | UserInteractionRequired.SignTransaction;

export enum SignTransactionDAStep {
  OPEN_APP = "signer.xrp.steps.openApp",
  SIGN_TRANSACTION = "signer.xrp.steps.signTransaction",
}

export type SignTransactionDAIntermediateValue = {
  requiredUserInteraction: SignTransactionDARequiredInteraction;
  step: SignTransactionDAStep;
};

export type SignTransactionDAInternalState = {
  readonly error: SignTransactionDAError | null;
  readonly signature: Signature | null;
};

export type SignTransactionDAReturnType = ExecuteDeviceActionReturnType<
  SignTransactionDAOutput,
  SignTransactionDAError,
  SignTransactionDAIntermediateValue
>;
