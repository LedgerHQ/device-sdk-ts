import { type OpenAppDAError } from "@ledgerhq/device-management-kit";
import { type Either } from "purify-ts";

import { type LKRPDeviceCommandError } from "@internal/app-binder/command/utils/ledgerKeyringProtocolErrors";
import { type LKRPDataSource } from "@internal/lkrp-datasource/data/LKRPDataSource";
import { type LKRPBlockStream } from "@internal/utils/LKRPBlockStream";
import { type Trustchain } from "@internal/utils/types";

import {
  type LKRPDataSourceError,
  type LKRPMissingDataError,
  type LKRPOutdatedTrustchainError,
  type LKRPParsingError,
  type LKRPTrustchainNotReady,
  type LKRPUnknownError,
} from "./Errors";
import { type JWT, type Keypair, type Permissions } from "./LKRPTypes";

export type AddToTrustchainDAOutput = undefined;

export type AddToTrustchainDAInput = Either<
  LKRPMissingDataError,
  {
    readonly lkrpDataSource: LKRPDataSource;
    readonly keypair: Keypair;
    readonly jwt: JWT;
    readonly trustchainId: string;
    readonly trustchain: Trustchain;
    readonly applicationStream: LKRPBlockStream;
    readonly clientName: string;
    readonly permissions: Permissions;
  }
>;

export type AddToTrustchainDAError =
  | LKRPDeviceCommandError
  | LKRPDataSourceError
  | LKRPParsingError
  | LKRPMissingDataError
  | LKRPOutdatedTrustchainError
  | LKRPTrustchainNotReady
  | OpenAppDAError
  | LKRPUnknownError;

export type AddToTrustchainDAIntermediateValue = {
  readonly requiredUserInteraction: string;
};

export type AddToTrustchainDAInternalState = Either<
  AddToTrustchainDAError,
  {
    readonly sessionKeypair: Keypair | null;
  }
>;
