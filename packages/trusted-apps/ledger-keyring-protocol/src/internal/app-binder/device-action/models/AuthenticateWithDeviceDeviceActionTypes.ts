import { type Either } from "purify-ts";

import {
  type AuthenticateDAError,
  type JWT,
  type Keypair,
  type Permissions,
} from "@api/index";
import { type LKRPDataSource } from "@internal/lkrp-datasource/data/LKRPDataSource";
import { type Trustchain } from "@internal/utils/Trustchain";

export type AuthenticateWithDeviceDAInput = {
  readonly lkrpDataSource: LKRPDataSource;
  readonly appId: number;
  readonly keypair: Keypair;
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
