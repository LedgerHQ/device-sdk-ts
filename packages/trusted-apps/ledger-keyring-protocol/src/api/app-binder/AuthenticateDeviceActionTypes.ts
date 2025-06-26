import { type ExecuteDeviceActionReturnType } from "@ledgerhq/device-management-kit";

import { type JWT, type Keypair } from "./LKRPTypes";

export type AuthenticateDAReturnType = ExecuteDeviceActionReturnType<
  AuthenticateDAOutput,
  AuthenticateDAError,
  AuthenticateDAIntermediateValue
>;

export type AuthenticateDAInput = {
  readonly applicationId: number;
  readonly keypair: Keypair;
  readonly trustchainId: string | null;
  readonly jwt: JWT | null;
};

export type AuthenticateDAOutput = {
  readonly jwt: JWT | null;
  readonly trustchainId: string | null;
  readonly applicationPath: string | null;
  readonly encryptionKey: Uint8Array | null;
};

export type AuthenticateDAError = {
  readonly _tag: string;
  readonly originalError?: unknown;
  message?: string;
};

export type AuthenticateDAIntermediateValue = {
  readonly requiredUserInteraction: string;
};
