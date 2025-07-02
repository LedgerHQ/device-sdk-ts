import { type AuthenticateDAReturnType } from "./app-binder/AuthenticateDeviceActionTypes";
import { type JWT, type Keypair } from "./app-binder/LKRPTypes";

export interface LedgerKeyringProtocol {
  athenticate: (
    keypair: Keypair,
    applicationId: number,
    trustchainId?: string,
    JWT?: JWT,
  ) => AuthenticateDAReturnType;

  encryptData: (encryptionKey: Uint8Array, data: Uint8Array) => Uint8Array;

  decryptData: (encryptionKey: Uint8Array, data: Uint8Array) => Uint8Array;
}
