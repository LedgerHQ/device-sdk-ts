import { type Either, type Maybe } from "purify-ts";

import {
  type JWT,
  type LKRPBlock,
  type Trustchain,
} from "@api/app-binder/LKRPTypes";

export interface LKRPDataSource {
  getChallenge(): Promise<Either<Error, Challenge>>;

  authenticate(payload: AuthenticationPayload): Promise<Either<Error, JWT>>;

  getTruschainId(jwt: JWT): Promise<Either<Error, Maybe<string>>>;

  getTrustchainById(
    id: string,
    jwt: JWT,
  ): Promise<Either<Error, Maybe<Trustchain>>>;

  postDerivation(id: string, stream: LKRPBlock[]): Promise<Either<Error, void>>;

  putCommands(
    id: string,
    path: string,
    blocks: LKRPBlock[], // In practice, this should be a single block
    jwt: JWT,
  ): Promise<Either<Error, void>>;
}

export type Challenge = { json: ChallengeJSON; tlv: string };

export type AuthenticationPayload = {
  challenge: ChallengeJSON;
  signature: ChallengeSignature;
};

export type ListTrustchainsResponse = {
  [trustchainId: string]: {
    [path: string]: string[]; // list of permissions
  };
};

type ChallengeJSON = {
  version: number;
  challenge: {
    data: string;
    expiry: string;
  };
  host: string;
  rp: { credential: Credential; signature: string }[];
  protocolVersion: {
    major: number;
    minor: number;
    patch: number;
  };
};

type ChallengeSignature = {
  credential: Credential;
  signature: string;
  attestation: string;
};

type Credential = {
  version: number;
  curveId: number;
  signAlgorithm: number;
  publicKey: string;
};
