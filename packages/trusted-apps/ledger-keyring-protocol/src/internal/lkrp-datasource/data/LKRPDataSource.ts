import { type EitherAsync, type Maybe } from "purify-ts";

import { type LKRPHttpRequestError } from "@api/app-binder/Errors";
import { type JWT } from "@api/app-binder/LKRPTypes";
import { type LKRPBlock } from "@internal/utils/LKRPBlock";
import { type LKRPBlockStream } from "@internal/utils/LKRPBlockStream";
import { type Trustchain } from "@internal/utils/types";

export interface LKRPDataSource {
  getChallenge(): EitherAsync<LKRPHttpRequestError, Challenge>;

  authenticate(
    payload: AuthenticationPayload,
  ): EitherAsync<LKRPHttpRequestError, AuthenticationResponse>;

  getTrustchainById(
    id: string,
    jwt: JWT,
  ): EitherAsync<LKRPHttpRequestError, Trustchain>;

  postDerivation(
    id: string,
    stream: LKRPBlockStream,
    jwt: JWT,
  ): EitherAsync<LKRPHttpRequestError, void>;

  putCommands(
    id: string,
    path: string,
    block: LKRPBlock,
    jwt: JWT,
  ): EitherAsync<LKRPHttpRequestError, void>;
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
