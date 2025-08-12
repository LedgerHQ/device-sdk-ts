import { type Either } from "purify-ts";

import { type AuthenticateDAError, type JWT, type Keypair } from "@api/index";
import { type LKRPDataSource } from "@internal/lkrp-datasource/data/LKRPDataSource";
import { type Trustchain } from "@internal/utils/Trustchain";

export type AuthenticateWithKeypairDAInput = {
  readonly lkrpDataSource: LKRPDataSource;
  readonly appId: number;
  readonly keypair: Keypair;
  readonly trustchainId: string;
};

export type AuthenticateWithKeypairDAInternalState = Either<
  AuthenticateDAError,
  {
    readonly jwt: JWT | null;
    readonly trustchain: Trustchain | null;
    readonly encryptionKey: Uint8Array | null;
  }
>;
