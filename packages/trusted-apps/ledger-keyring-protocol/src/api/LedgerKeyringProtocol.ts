import { type AuthenticateUsecaseInput } from "@internal/use-cases/authentication/AuthenticateUseCase";

import { type AuthenticateDAReturnType } from "./app-binder/AuthenticateDeviceActionTypes";

export interface LedgerKeyringProtocol {
  authenticate: (input: AuthenticateUsecaseInput) => AuthenticateDAReturnType;

  encryptData: (
    encryptionKey: Uint8Array,
    data: Uint8Array,
  ) => Promise<Uint8Array>;

  decryptData: (
    encryptionKey: Uint8Array,
    data: Uint8Array,
  ) => Promise<Uint8Array>;
}
