export type GetAddressCommandResponse = {
  readonly publicKey: string;
  readonly address: string;
  readonly chainCode?: string;
};
