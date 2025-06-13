import { type Either, type Maybe } from "purify-ts";

import {
  type Block,
  type JWT,
  type KeyPair,
  type Trustchain,
} from "./LKRPTypes";

export type EnsureIsMemberDAOutput = {
  readonly applicationPath: string;
  readonly encryptionKey: Uint8Array;
};

export type EnsureIsMemberDAInput = {
  readonly applicationId: number;
  readonly keypair: KeyPair;
  readonly jwt: Maybe<JWT>;
};

export type EnsureIsMemberDAError = {
  readonly _tag: string;
  readonly originalError?: unknown;
  message?: string;
};

export type EnsureIsMemberDAIntermediateValue = {
  readonly requiredUserInteraction: string;
};

export type EnsureIsMemberDAInternalState = Either<
  EnsureIsMemberDAError,
  {
    readonly applicationPath: Maybe<string>;
    readonly encryptionKey: Maybe<Uint8Array>;
    readonly trustchain: Maybe<Trustchain>;
    readonly shouldDerive: Maybe<boolean>;
    readonly signedBlock: Maybe<Block>;
  }
>;
