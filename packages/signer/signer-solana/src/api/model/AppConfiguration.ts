import { type PublicKeyDisplayMode } from "./PublicKeyDisplayMode";

export type AppConfiguration = {
  blindSigningEnabled: boolean;
  pubKeyDisplayMode: PublicKeyDisplayMode;
  version: string;
};
