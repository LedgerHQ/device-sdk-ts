import { type AuthenticateDAReturnType } from "./app-binder/AuthenticateDeviceActionTypes";
import {
  type JWT,
  type Keypair,
  type Permissions,
} from "./app-binder/LKRPTypes";

export interface LedgerKeyringProtocol {
  authenticate: (
    keypair: Keypair,
    applicationId: number,
    clientName: string,
    permissions: Permissions,
    trustchainId?: string,
    JWT?: JWT,
  ) => AuthenticateDAReturnType;

  encryptData: (encryptionKey: Uint8Array, data: Uint8Array) => Uint8Array;

  decryptData: (encryptionKey: Uint8Array, data: Uint8Array) => Uint8Array;
}
