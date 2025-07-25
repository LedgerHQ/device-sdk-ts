import {
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
  type UnknownDAError,
} from "@ledgerhq/device-management-kit";
import { type Either } from "purify-ts";

import { type LKRPDeviceCommandError } from "@internal/app-binder/command/utils/ledgerKeyringProtocolErrors";
import { type LKRPDataSource } from "@internal/lkrp-datasource/data/LKRPDataSource";

import {
  type LKRPHttpRequestError,
  type LKRPMissingDataError,
  type LKRPParsingError,
  type LKRPUnhandledState,
} from "./Errors";
import { type JWT, type Keypair } from "./LKRPTypes";

export type AuthenticateDAReturnType = ExecuteDeviceActionReturnType<
  AuthenticateDAOutput,
  AuthenticateDAError,
  AuthenticateDAIntermediateValue
>;

export type AuthenticateDAInput = {
  readonly lkrpDataSource: LKRPDataSource;
  readonly applicationId: number;
  readonly keypair: Keypair;
  readonly trustchainId: string | null;
  readonly jwt: JWT | null;
};

export type AuthenticateDAOutput = {
  readonly jwt: JWT | null;
  readonly trustchainId: string | null;
  readonly applicationPath: string | null;
  readonly encryptionKey: Uint8Array | null;
};

export type AuthenticateDAError =
  | LKRPDeviceCommandError
  | LKRPHttpRequestError
  | LKRPParsingError
  | LKRPMissingDataError
  | LKRPUnhandledState
  | OpenAppDAError
  | UnknownDAError;

export type AuthenticateDAIntermediateValue = {
  readonly requiredUserInteraction: string;
};

export type AuthenticateDAInternalState = Either<
  AuthenticateDAError,
  {
    readonly trustchainId: string | null;
    readonly jwt: JWT | null;
    readonly applicationPath: string | null;
    readonly encryptionKey: Uint8Array | null;
  }
>;
