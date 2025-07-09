import { type Either, type Maybe } from "purify-ts";

import { type LKRPHttpRequestError } from "@api/app-binder/Errors";
import { type JWT } from "@api/app-binder/LKRPTypes";
import { type LKRPBlock } from "@internal/utils/LKRPBlock";
import { type LKRPBlockStream } from "@internal/utils/LKRPBlockStream";
import { type Trustchain } from "@internal/utils/types";

export interface LKRPDataSource {
  getChallenge(): Promise<Either<LKRPHttpRequestError, Challenge>>;

  authenticate(
    payload: AuthenticationPayload,
  ): Promise<
    Either<LKRPHttpRequestError, { jwt: JWT; trustchainId: Maybe<string> }>
  >;

  getTrustchainById(
    id: string,
    jwt: JWT,
  ): Promise<Either<LKRPHttpRequestError, Trustchain>>;

  postDerivation(
    id: string,
    stream: LKRPBlockStream,
    jwt: JWT,
  ): Promise<Either<LKRPHttpRequestError, void>>;

  putCommands(
    id: string,
    path: string,
    block: LKRPBlock,
    jwt: JWT,
  ): Promise<Either<LKRPHttpRequestError, void>>;
}

export type Challenge = { json: ChallengeJSON; tlv: string };

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
