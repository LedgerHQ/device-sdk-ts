/**
 * Tron device app configuration, as reported by the `getAppConfiguration` APDU.
 *
 * Mirrors the shape returned by `@ledgerhq/hw-app-trx`.
 */
export type AppConfiguration = {
  version: string;
  versionN: number;
  allowData: boolean;
  allowContract: boolean;
  truncateAddress: boolean;
  signByHash: boolean;
};
