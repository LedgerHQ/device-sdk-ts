import {
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type OpenAppDARequiredInteraction,
  type UserInteractionRequired,
} from "@ledgerhq/device-management-kit";

import {
  type LKRPDataSourceError,
  type LKRPMissingDataError,
  type LKRPParsingError,
  type LKRPLedgerKeyRingProtocolNotReady,
  type LKRPUnauthorizedError,
  type LKRPUnknownError,
} from "@api/model/Errors";
import { type JWT } from "@api/model/JWT";
import { type LKRPDeviceCommandError } from "@internal/app-binder/command/utils/ledgerKeyRingProtocolErrors";

import {
  type AddToLedgerKeyRingProtocolDAError,
  type AddToLedgerKeyRingProtocolDAIntermediateValue,
} from "./AddToLedgerKeyRingProtocolDeviceActionTypes";

export type AuthenticateDAReturnType = ExecuteDeviceActionReturnType<
  AuthenticateDAOutput,
  AuthenticateDAError,
  AuthenticateDAIntermediateValue
>;

export type AuthenticateDAOutput = {
  readonly jwt: JWT;
  readonly LedgerKeyRingProtocolId: string;
  readonly applicationPath: string;
  readonly encryptionKey: Uint8Array;
};

export type AuthenticateDAError =
  | LKRPUnauthorizedError
  | AddToLedgerKeyRingProtocolDAError
  | LKRPDeviceCommandError
  | LKRPDataSourceError
  | LKRPParsingError
  | LKRPMissingDataError
  | LKRPLedgerKeyRingProtocolNotReady
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
        | AuthenticateDAStep.GetLedgerKeyRingProtocol
        | AuthenticateDAStep.ExtractEncryptionKey;
    }
  | AddToLedgerKeyRingProtocolDAIntermediateValue;

export enum AuthenticateDAState {
  Authenticate = "lkrp-authenticate",
}
export enum AuthenticateDAStep {
  OpenApp = "lkrp.steps.openApp",
  Authenticate = "lkrp.steps.authenticate",
  GetLedgerKeyRingProtocol = "lkrp.steps.getLedgerKeyRingProtocol",
  ExtractEncryptionKey = "lkrp.steps.extractEncryptionKey",
}
