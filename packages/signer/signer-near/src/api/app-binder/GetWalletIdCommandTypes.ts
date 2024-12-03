export type GetWalletIdCommandResponse = {
  readonly walletId: Uint8Array;
};

export type GetWalletIdCommandArgs = {
  derivationPath: string;
  checkOnDevice: boolean;
};
