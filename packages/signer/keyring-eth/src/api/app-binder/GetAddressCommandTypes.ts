export type GetAddressCommandResponse = {
  readonly publicKey: string;
  readonly address: `0x${string}`;
  readonly chainCode?: string;
};

export type GetAddressCommandArgs = {
  readonly derivationPath: string;
  readonly checkOnDevice?: boolean;
  readonly returnChainCode?: boolean;
};
