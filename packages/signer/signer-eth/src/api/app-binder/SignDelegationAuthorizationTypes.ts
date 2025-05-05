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
  | UserInteractionRequired.SignEIP7702;

export type SignDelegationAuthorizationDAIntermediateValue = {
  requiredUserInteraction: SignDelegationAuthorizationDARequiredInteraction;
};

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
