import {
  type ExecuteDeviceActionReturnType,
  type OpenAppDAError,
} from "@ledgerhq/device-management-kit";
import { type Either } from "purify-ts";

import { type LKRPDeviceCommandError } from "@internal/app-binder/command/utils/ledgerKeyringProtocolErrors";
import { type LKRPDataSource } from "@internal/lkrp-datasource/data/LKRPDataSource";
import { type Trustchain } from "@internal/models/Types";
import { type LKRPBlockStream } from "@internal/utils/LKRPBlockStream";

import { type AddToTrustchainDAError } from "./AddToTrustchainDeviceActionTypes";
import {
  type LKRPDataSourceError,
  type LKRPMissingDataError,
  type LKRPParsingError,
  type LKRPTrustchainNotReady,
  type LKRPUnauthorizedError,
  type LKRPUnknownError,
} from "./Errors";
import { type JWT, type Keypair, type Permissions } from "./LKRPTypes";

export type AuthenticateDAReturnType = ExecuteDeviceActionReturnType<
  AuthenticateDAOutput,
  AuthenticateDAError,
  AuthenticateDAIntermediateValue
>;

export type AuthenticateDAInput = {
  readonly lkrpDataSource: LKRPDataSource;
  readonly applicationId: number;
  readonly keypair: Keypair;
  readonly clientName: string;
  readonly permissions: Permissions;
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

export type AuthenticateDAInternalState = Either<
  AuthenticateDAError,
  {
    readonly trustchainId: string | null;
    readonly jwt: JWT | null;
    readonly trustchain: Trustchain | null;
    readonly applicationStream: LKRPBlockStream | null;
    readonly encryptionKey: Uint8Array | null;
    readonly wasAddedToTrustchain: boolean;
  }
>;
