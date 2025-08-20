import { type AuthenticateUsecaseInput } from "@internal/use-cases/authentication/AuthenticateUseCase";

import { type AuthenticateDAReturnType } from "./app-binder/AuthenticateDeviceActionTypes";

export interface LedgerKeyringProtocol {
  authenticate: (input: AuthenticateUsecaseInput) => AuthenticateDAReturnType;

  encryptData: (xpriv: Uint8Array, data: Uint8Array) => Uint8Array;

  decryptData: (xpriv: Uint8Array, data: Uint8Array) => Uint8Array;
}
