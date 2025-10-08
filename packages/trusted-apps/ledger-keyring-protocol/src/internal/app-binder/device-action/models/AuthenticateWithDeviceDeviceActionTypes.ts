import { type Either } from "purify-ts";

import { type CryptoService } from "@api/crypto/CryptoService";
import { type KeyPair } from "@api/crypto/KeyPair";
import {
  type AuthenticateDAError,
  type JWT,
  type Permissions,
} from "@api/index";
import { type LKRPDataSource } from "@internal/lkrp-datasource/data/LKRPDataSource";
import { type Trustchain } from "@internal/utils/Trustchain";

export type AuthenticateWithDeviceDAInput = {
  readonly lkrpDataSource: LKRPDataSource;
  readonly appId: number;
  readonly cryptoService: CryptoService;
  readonly keypair: KeyPair;
  readonly clientName: string;
  readonly permissions: Permissions;
};

export type AuthenticateWithDeviceDAInternalState = Either<
  AuthenticateDAError,
  {
    readonly trustchainId: string | null;
    readonly jwt: JWT | null;
    readonly trustchain: Trustchain | null;
    readonly encryptionKey: Uint8Array | null;
    readonly wasAddedToTrustchain: boolean;
  }
>;
