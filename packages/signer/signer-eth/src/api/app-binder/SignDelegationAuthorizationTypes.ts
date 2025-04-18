import {
  CommandErrorResult,
  DeviceActionState,
  ExecuteDeviceActionReturnType,
  OpenAppDAError,
  OpenAppDARequiredInteraction,
  UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { Signature } from "@api/model/Signature";
import { EthErrorCodes } from "@internal/app-binder/command/utils/ethAppErrors";

export type SignDelegationAuthorizationDAOutput = Signature;

export type SignDelegationAuthorizationDAInput = {
  readonly derivationPath: string;
  readonly address: `0x${string}`;
  readonly chainId: number;
  readonly nonce: number;
};

export type SignDelegationAuthorizationDAError =
  | OpenAppDAError
  | CommandErrorResult<EthErrorCodes>["error"];

type SignDelegationAuthorizationDARequiredInteraction =
  | OpenAppDARequiredInteraction
  | UserInteractionRequired.SignTransaction;

export type SignDelegationAuthorizationDAIntermediateValue = {
  requiredUserInteraction: SignDelegationAuthorizationDARequiredInteraction;
  step: SignDelegationAuthorizationDAStep;
};

export enum SignDelegationAuthorizationDAStep {
  OPEN_APP = "signer.eth.steps.openApp",
  GET_APP_CONFIG = "signer.eth.steps.getAppConfig",
  SIGN_DELEGATION_AUTHORIZATION = "signer.eth.steps.signDelegationAuthorization",
}

export type SignDelegationAuthorizationDAState = DeviceActionState<
  SignDelegationAuthorizationDAOutput,
  SignDelegationAuthorizationDAError,
  SignDelegationAuthorizationDAIntermediateValue
>;

export type SignDelegationAuthorizationDAReturnType =
  ExecuteDeviceActionReturnType<
    SignDelegationAuthorizationDAOutput,
    SignDelegationAuthorizationDAError,
    SignDelegationAuthorizationDAIntermediateValue
  >;
