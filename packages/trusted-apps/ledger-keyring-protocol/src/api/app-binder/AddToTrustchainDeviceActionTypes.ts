import {
  type OpenAppDAError,
  type UnknownDAError,
} from "@ledgerhq/device-management-kit";
import { type Either } from "purify-ts";

import { type LKRPDeviceCommandError } from "@internal/app-binder/command/utils/ledgerKeyringProtocolErrors";
import { type LKRPDataSource } from "@internal/lkrp-datasource/data/LKRPDataSource";
import { type LKRPBlockStream } from "@internal/utils/LKRPBlockStream";
import { type Trustchain } from "@internal/utils/types";

import {
  type LKRPHttpRequestError,
  type LKRPMissingDataError,
  type LKRPParsingError,
} from "./Errors";
import { type JWT, type Keypair } from "./LKRPTypes";

export type AddToTrustchainDAOutput = {
  readonly trustchain: Trustchain;
  readonly applicationStream: LKRPBlockStream;
};

export type AddToTrustchainDAInput = Either<
  LKRPMissingDataError,
  {
    readonly lkrpDataSource: LKRPDataSource;
    readonly keypair: Keypair;
    readonly jwt: JWT;
    readonly trustchain: Trustchain;
    readonly applicationStream: LKRPBlockStream;
  }
>;

export type AddToTrustchainDAError =
  | LKRPDeviceCommandError
  | LKRPHttpRequestError
  | LKRPParsingError
  | LKRPMissingDataError
  | OpenAppDAError
  | UnknownDAError;

export type AddToTrustchainDAIntermediateValue = {
  readonly requiredUserInteraction: string;
};

export type AddToTrustchainDAInternalState = Either<
  AddToTrustchainDAError,
  {
    readonly trustchain: Trustchain | null;
    readonly applicationStream: LKRPBlockStream | null;
    readonly sessionKeypair: Keypair | null;
  }
>;
