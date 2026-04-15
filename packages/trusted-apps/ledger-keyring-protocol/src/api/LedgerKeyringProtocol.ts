import { type DeviceSessionId } from "@ledgerhq/device-management-kit";

import { type AuthenticateUsecaseInput } from "@internal/use-cases/authentication/AuthenticateUseCase";

import { type AuthenticateDAReturnType } from "./app-binder/AuthenticateDeviceActionTypes";
import { type LedgerProofDAReturnType } from "./app-binder/LedgerProofDeviceActionTypes";

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

  ledgerProofEncrypt: (input: {
    intent: string;
    blob: Uint8Array;
    sessionId: DeviceSessionId;
  }) => LedgerProofDAReturnType;

  ledgerProofDecrypt: (input: {
    domain: string;
    encryptedData: Uint8Array;
    sessionId: DeviceSessionId;
  }) => LedgerProofDAReturnType;
}
