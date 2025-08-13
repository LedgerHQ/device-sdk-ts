import {
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import { type LKRPDeviceCommandError } from "@internal/app-binder/command/utils/ledgerKeyringProtocolErrors";

import {
  type AddToTrustchainDAError,
  type AddToTrustchainDAIntermediateValue,
} from "./AddToTrustchainDeviceActionTypes";
import {
  type LKRPDataSourceError,
  type LKRPMissingDataError,
  type LKRPParsingError,
  type LKRPTrustchainNotReady,
  type LKRPUnauthorizedError,
  type LKRPUnknownError,
} from "./Errors";
import { type JWT } from "./LKRPTypes";

export type AuthenticateDAReturnType = ExecuteDeviceActionReturnType<
  AuthenticateDAOutput,
  AuthenticateDAError,
  AuthenticateDAIntermediateValue
>;

export type AuthenticateDAOutput = {
  readonly jwt: JWT;
  readonly trustchainId: string;
  readonly applicationPath: string;
  readonly encryptionKey: Uint8Array;
};

export type AuthenticateDAError =
  | LKRPUnauthorizedError
  | AddToTrustchainDAError
  | LKRPDeviceCommandError
  | LKRPDataSourceError
  | LKRPParsingError
  | LKRPMissingDataError
  | LKRPTrustchainNotReady
  | OpenAppDAError
  | LKRPUnknownError;

export type AuthenticateDAIntermediateValue =
  | {
      requiredUserInteraction: OpenAppDARequiredInteraction;
      step: AuthenticateDAStep.OpenApp;
    }
  | {
      requiredUserInteraction: AuthenticateDAState.Authenticate;
      step: AuthenticateDAStep.Authenticate;
    }
  | {
      requiredUserInteraction: UserInteractionRequired.None;
      step?:
        | AuthenticateDAStep.Authenticate
        | AuthenticateDAStep.GetTrustchain
        | AuthenticateDAStep.ExtractEncryptionKey;
    }
  | AddToTrustchainDAIntermediateValue;

export enum AuthenticateDAState {
  Authenticate = "lkrp-authenticate",
}
export enum AuthenticateDAStep {
  OpenApp = "lkrp.steps.openApp",
  Authenticate = "lkrp.steps.authenticate",
  GetTrustchain = "lkrp.steps.getTrustchain",
  ExtractEncryptionKey = "lkrp.steps.extractEncryptionKey",
}
