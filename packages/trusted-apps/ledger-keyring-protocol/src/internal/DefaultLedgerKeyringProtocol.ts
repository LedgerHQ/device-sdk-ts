import {
  type DeviceManagementKit,
  type DeviceSessionId,
} from "@ledgerhq/device-management-kit";
import { type Container } from "inversify";

import { type AuthenticateDAReturnType } from "@api/app-binder/AuthenticateDeviceActionTypes";
import { type JWT, type Keypair } from "@api/app-binder/LKRPTypes";
import { type LedgerKeyringProtocol } from "@api/LedgerKeyringProtocol";
import { makeContainer } from "@internal/di";

type DefaultLedgerKeyringProtocolConstructorArgs = {
  dmk: DeviceManagementKit;
  sessionId: DeviceSessionId;
};

export class DefaultLedgerKeyringProtocol implements LedgerKeyringProtocol {
  name: string;
  private _container: Container;

  constructor({ dmk, sessionId }: DefaultLedgerKeyringProtocolConstructorArgs) {
    this.name = "Ledger Keyring Protocol";
    this._container = makeContainer({ dmk, sessionId });
  }

  athenticate(
    keypair: Keypair,
    applicationId: number,
    trustchainId?: string,
    JWT?: JWT,
  ): AuthenticateDAReturnType {
    throw new Error("Method not implemented.", {
      cause: {
        container: this._container,
        args: { keypair, applicationId, trustchainId, JWT },
      },
    });
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
