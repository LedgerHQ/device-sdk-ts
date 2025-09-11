import { type EitherAsync, type Maybe } from "purify-ts";

import { type LKRPDataSourceError } from "@api/model/Errors";
import { type JWT } from "@api/model/JWT";
import { type LKRPBlock } from "@internal/utils/LKRPBlock";
import { type Trustchain } from "@internal/utils/Trustchain";

export interface LKRPDataSource {
  getChallenge(): EitherAsync<LKRPDataSourceError, Challenge>;

  authenticate(
    payload: AuthenticationPayload,
  ): EitherAsync<LKRPDataSourceError, AuthenticationResponse>;

  getTrustchainById(
    id: string,
    jwt: JWT,
  ): EitherAsync<LKRPDataSourceError, Trustchain>;

  postDerivation(
    id: string,
    blocks: LKRPBlock,
    jwt: JWT,
  ): EitherAsync<LKRPDataSourceError, void>;

  putCommands(
    id: string,
    path: string,
    block: LKRPBlock,
    jwt: JWT,
  ): EitherAsync<LKRPDataSourceError, void>;
}

export type Challenge = { json: ChallengeJSON; tlv: string };

export type AuthenticationResponse = {
  jwt: JWT;
  trustchainId: Maybe<string>;
};

export type AuthenticationPayload = {
  challenge: ChallengeJSON;
  signature: ChallengeSignature;
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
