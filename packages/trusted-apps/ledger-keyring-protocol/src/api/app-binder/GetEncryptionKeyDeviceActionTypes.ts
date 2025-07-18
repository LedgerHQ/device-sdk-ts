import {
  type OpenAppDAError,
  type UnknownDAError,
} from "@ledgerhq/device-management-kit";
import { type Either } from "purify-ts";

import { type LKKPDeviceCommandError } from "@internal/app-binder/command/utils/ledgerKeyringProtocolErrors";
import { type LKRPDataSource } from "@internal/lkrp-datasource/data/LKRPDataSource";
import { type LKRPBlock } from "@internal/utils/LKRPBlock";
import { type LKRPBlockStream } from "@internal/utils/LKRPBlockStream";
import { type Trustchain } from "@internal/utils/types";

import {
  type LKRPHttpRequestError,
  type LKRPMissingDataError,
  type LKRPParsingError,
} from "./Errors";
import { type JWT, type Keypair } from "./LKRPTypes";

export type GetEncryptionKeyDAOutput = {
  readonly applicationPath: string;
  readonly encryptionKey: Uint8Array;
};

export type GetEncryptionKeyDAInput = Either<
  LKRPMissingDataError,
  {
    readonly lkrpDataSource: LKRPDataSource;
    readonly applicationId: number;
    readonly keypair: Keypair;
    readonly jwt: JWT;
    readonly trustchainId: string;
  }
>;

export type GetEncryptionKeyDAError =
  | LKKPDeviceCommandError
  | LKRPHttpRequestError
  | LKRPParsingError
  | LKRPMissingDataError
  | OpenAppDAError
  | UnknownDAError;

export type GetEncryptionKeyDAIntermediateValue = {
  readonly requiredUserInteraction: string;
};

export type GetEncryptionKeyDAInternalState = Either<
  GetEncryptionKeyDAError,
  {
    readonly trustchain: Trustchain | null;
    readonly applicationStream: LKRPBlockStream | null;
    readonly signedBlock: LKRPBlock | null;
    readonly encryptionKey: Uint8Array | null;
  }
>;
