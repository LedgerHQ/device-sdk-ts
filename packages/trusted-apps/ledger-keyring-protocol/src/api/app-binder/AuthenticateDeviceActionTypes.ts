import { type Either, type Maybe } from "purify-ts";

import { type JWT, type KeyPair } from "./LKRPTypes";

export type AuthenticateDAOutput = {
  readonly jwt: JWT | null;
  readonly trustchainId: string | null;
  readonly applicationPath: string | null;
  readonly encryptionKey: Uint8Array | null;
};

export type AuthenticateDAInput = {
  readonly applicationId: number;
  readonly keypair: KeyPair;
  readonly trustchainId: string | null;
  readonly jwt: JWT | null;
};

export type AuthenticateDAError = {
  readonly _tag: string;
  readonly originalError?: unknown;
  message?: string;
};

export type AuthenticateDAIntermediateValue = {
  readonly requiredUserInteraction: string;
};

export type AuthenticateDAInternalState = Either<
  AuthenticateDAError,
  {
    readonly newJwt: Maybe<JWT>;
    readonly trustchainId: Maybe<string>;
    readonly applicationPath: Maybe<string>;
    readonly encryptionKey: Maybe<Uint8Array>;
  }
>;
