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

// How the coin hashes and serializes its transactions: "bip143" hashes every
// transaction with BIP143, even without SegWit inputs, and "sapling" is the v4
// format of Komodo, hashed with BIP143.
export type TransactionFormat = "legacy" | "bip143" | "sapling";

export type LegacyCoinProfile<ErrorCodes extends string> = {
  appName: string;
  errors: LegacyErrorConfig<ErrorCodes>;
  // BIP32 version bytes of the coin's extended public keys, such as 0x019da462 ("Ltub").
  xpubVersion: number;
  // The coin has SegWit, so a transaction can spend SegWit outputs.
  segwit: boolean;
  // The default sighash type: SIGHASH_ALL, or SIGHASH_ALL | SIGHASH_FORKID for
  // Bitcoin Cash and Bitcoin Gold.
  sigHashType: number;
  transactionFormat: TransactionFormat;
};
