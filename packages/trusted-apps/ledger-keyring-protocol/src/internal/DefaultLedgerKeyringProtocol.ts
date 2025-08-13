import { type DeviceManagementKit } from "@ledgerhq/device-management-kit";
import { type Container } from "inversify";

import { type AuthenticateDAReturnType } from "@api/app-binder/AuthenticateDeviceActionTypes";
import { type LKRPEnv } from "@api/app-binder/LKRPTypes";
import { type LedgerKeyringProtocol } from "@api/LedgerKeyringProtocol";
import { makeContainer } from "@internal/di";

import {
  type AuthenticateUseCase,
  type AuthenticateUsecaseInput,
} from "./use-cases/authentication/AuthenticateUseCase";
import { type DecryptDataUseCase } from "./use-cases/authentication/DecryptDataUseCase";
import { type EncryptDataUseCase } from "./use-cases/authentication/EncryptDataUseCase";
import { useCasesTypes } from "./use-cases/di/useCasesTypes";

type DefaultLedgerKeyringProtocolConstructorArgs = {
  dmk: DeviceManagementKit;
  applicationId: number;
  env?: LKRPEnv;
  baseUrl?: string;
};

export class DefaultLedgerKeyringProtocol implements LedgerKeyringProtocol {
  name: string;
  private _container: Container;

  constructor({
    dmk,
    applicationId,
    env,
    baseUrl,
  }: DefaultLedgerKeyringProtocolConstructorArgs) {
    this.name = "Ledger Keyring Protocol";
    this._container = makeContainer({
      dmk,
      applicationId,
      env,
      baseUrl,
    });
  }

  authenticate(input: AuthenticateUsecaseInput): AuthenticateDAReturnType {
    return this._container
      .get<AuthenticateUseCase>(useCasesTypes.AuthenticateUseCase)
      .execute(input);
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
