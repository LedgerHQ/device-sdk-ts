import {
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
} from "@ledgerhq/device-management-kit";

import { type LKRPDeviceCommandError } from "@internal/app-binder/command/utils/ledgerKeyringProtocolErrors";

import { type AddToTrustchainDAError } from "./AddToTrustchainDeviceActionTypes";
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

export type AuthenticateDAIntermediateValue = {
  readonly requiredUserInteraction: string;
};
