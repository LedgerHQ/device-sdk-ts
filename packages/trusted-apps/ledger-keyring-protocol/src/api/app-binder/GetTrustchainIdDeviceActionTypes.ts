import { type Either, type Maybe } from "purify-ts";

import { type JWT } from "./LKRPTypes";

export type GetTrustchainRootDAOutput = string;

export type GetTrustchainRootDAInput = {
  readonly jwt: Maybe<JWT>;
};

export type GetTrustchainRootDAError = {
  readonly _tag: string;
  readonly originalError?: unknown;
  message?: string;
};

export type GetTrustchainRootDAIntermediateValue = {
  readonly requiredUserInteraction: string;
};

export type GetTrustchainRootDAInternalState = Either<
  GetTrustchainRootDAError,
  {
    readonly trustchainId: Maybe<string>;
    readonly trustchains: Maybe<TrustchainsResponse>;
  }
>;

export type TrustchainsResponse = {
  [trustchainId: string]: {
    [path: string]: string[]; // list of permissions
  };
};
