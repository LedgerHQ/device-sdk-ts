import { type DeviceSessionId } from "@ledgerhq/device-management-kit";

import { type AuthenticateUsecaseInput } from "@internal/use-cases/authentication/AuthenticateUseCase";

import { type AuthenticateDAReturnType } from "./app-binder/AuthenticateDeviceActionTypes";
import { type LedgerIdentityDAReturnType } from "./app-binder/LedgerIdentityDeviceActionTypes";

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

  ledgerIdentityEncrypt: (input: {
    intent: string;
    blob: Uint8Array;
    sessionId: DeviceSessionId;
  }) => LedgerIdentityDAReturnType;

  ledgerIdentityDecrypt: (input: {
    encryptedData: Uint8Array;
    sessionId: DeviceSessionId;
  }) => LedgerIdentityDAReturnType;
}
