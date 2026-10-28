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
  // The coin has SegWit, so a transaction can spend SegWit outputs.
  segwit: boolean;
};
