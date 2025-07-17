import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { type Container } from "inversify";

import { type AuthenticateDAReturnType } from "@api/app-binder/AuthenticateDeviceActionTypes";
import { type JWT, type Keypair } from "@api/app-binder/LKRPTypes";
import { type LedgerKeyringProtocol } from "@api/LedgerKeyringProtocol";
import { makeContainer } from "@internal/di";

import { type AuthenticateUseCase } from "./use-cases/authentication/AuthenticateUseCase";
import { useCasesTypes } from "./use-cases/di/useCasesTypes";

type DefaultLedgerKeyringProtocolConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
  baseUrl: string;
};

export class DefaultLedgerKeyringProtocol implements LedgerKeyringProtocol {
  name: string;
  private _container: Container;

  constructor({
    dmk,
    sessionId,
    baseUrl,
  }: DefaultLedgerKeyringProtocolConstructorArgs) {
    this.name = "Ledger Keyring Protocol";
    this._container = makeContainer({ dmk, sessionId, baseUrl });
  }

  authenticate(
    keypair: Keypair,
    applicationId: number,
    trustchainId?: string,
    jwt?: JWT,
  ): AuthenticateDAReturnType {
    return this._container
      .get<AuthenticateUseCase>(useCasesTypes.AuthenticateUseCase)
      .execute(keypair, applicationId, trustchainId, jwt);
  }

  encryptData(encryptionKey: Uint8Array, data: Uint8Array): Uint8Array {
    throw new Error("Method not implemented.", {
      cause: { args: { encryptionKey, data } },
    });
  }

  decryptData(encryptionKey: Uint8Array, data: Uint8Array): Uint8Array {
    throw new Error("Method not implemented.", {
      cause: { args: { encryptionKey, data } },
    });
  }
}
