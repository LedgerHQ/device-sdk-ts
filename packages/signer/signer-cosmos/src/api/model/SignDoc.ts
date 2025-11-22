export type SignDoc<T = Uint8Array> = {
  bodyBytes: T;
  authInfoBytes: T;
  chainId: string;
  accountNumber: bigint;
};
