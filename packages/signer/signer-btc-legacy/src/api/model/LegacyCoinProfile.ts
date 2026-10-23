import {
  type CommandErrorArgs,
  type CommandErrors,
  type DeviceExchangeError,
} from "@ledgerhq/device-management-kit";

export type LegacyErrorConfig<ErrorCodes extends string> = {
  errors: CommandErrors<ErrorCodes>;
  factory: (
    args: CommandErrorArgs<ErrorCodes>,
  ) => DeviceExchangeError<ErrorCodes>;
};

export type LegacyCoinProfile<ErrorCodes extends string> = {
  appName: string;
  errors: LegacyErrorConfig<ErrorCodes>;
  // BIP32 version bytes of the coin's extended public keys, such as 0x019da462 ("Ltub").
  xpubVersion: number;
  // The default sighash type: SIGHASH_ALL, or SIGHASH_ALL | SIGHASH_FORKID for
  // Bitcoin Cash and Bitcoin Gold.
  sigHashType: number;
  // Every transaction is hashed with BIP143, even without SegWit inputs.
  bip143: boolean;
};
