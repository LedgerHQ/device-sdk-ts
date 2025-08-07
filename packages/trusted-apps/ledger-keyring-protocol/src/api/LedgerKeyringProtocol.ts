import { type AuthenticateDAReturnType } from "./app-binder/AuthenticateDeviceActionTypes";
import { type Keypair, type Permissions } from "./app-binder/LKRPTypes";

export interface LedgerKeyringProtocol {
  authenticate: (
    keypair: Keypair,
    clientName: string,
    permissions: Permissions,
    trustchainId?: string,
  ) => AuthenticateDAReturnType;

  encryptData: (xpriv: Uint8Array, data: Uint8Array) => Uint8Array;

  decryptData: (xpriv: Uint8Array, data: Uint8Array) => Uint8Array;
}
