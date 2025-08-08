import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { type Container } from "inversify";

import { type AuthenticateDAReturnType } from "@api/app-binder/AuthenticateDeviceActionTypes";
import {
  type Keypair,
  type LKRPEnv,
  type Permissions,
} from "@api/app-binder/LKRPTypes";
import { type LedgerKeyringProtocol } from "@api/LedgerKeyringProtocol";
import { makeContainer } from "@internal/di";

import { type AuthenticateUseCase } from "./use-cases/authentication/AuthenticateUseCase";
import { type DecryptDataUseCase } from "./use-cases/authentication/DecryptDataUseCase";
import { type EncryptDataUseCase } from "./use-cases/authentication/EncryptDataUseCase";
import { useCasesTypes } from "./use-cases/di/useCasesTypes";

type DefaultLedgerKeyringProtocolConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
  applicationId: number;
  env?: LKRPEnv;
  baseUrl?: string;
};

export class DefaultLedgerKeyringProtocol implements LedgerKeyringProtocol {
  name: string;
  private _container: Container;

  constructor({
    dmk,
    sessionId,
    applicationId,
    env,
    baseUrl,
  }: DefaultLedgerKeyringProtocolConstructorArgs) {
    this.name = "Ledger Keyring Protocol";
    this._container = makeContainer({
      dmk,
      sessionId,
      applicationId,
      env,
      baseUrl,
    });
  }

  authenticate(
    keypair: Keypair,
    clientName: string,
    permissions: Permissions,
    trustchainId?: string,
  ): AuthenticateDAReturnType {
    return this._container
      .get<AuthenticateUseCase>(useCasesTypes.AuthenticateUseCase)
      .execute(keypair, clientName, permissions, trustchainId);
  }

  encryptData(encryptionKey: Uint8Array, data: Uint8Array): Uint8Array {
    return this._container
      .get<EncryptDataUseCase>(useCasesTypes.EncryptDataUseCase)
      .execute(encryptionKey, data);
  }

  decryptData(encryptionKey: Uint8Array, data: Uint8Array): Uint8Array {
    return this._container
      .get<DecryptDataUseCase>(useCasesTypes.DecryptDataUseCase)
      .execute(encryptionKey, data);
  }
}
