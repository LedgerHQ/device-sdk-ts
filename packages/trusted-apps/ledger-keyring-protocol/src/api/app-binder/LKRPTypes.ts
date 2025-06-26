import { type Jwt } from "jsonwebtoken";

export type Keypair = {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
};

export type JWT = Jwt & { token: string };
